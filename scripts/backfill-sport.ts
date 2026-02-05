import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

// Load .env.local first (Next.js convention), then fall back to .env
dotenv.config({ path: '.env.production' });
dotenv.config();

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const SPORT = 'Badminton';

const EXCEL_FILE = `scripts/data/IIMA ${SPORT} Ladder.xlsx`;

async function backfill() {
    console.log(`Starting Unified ${SPORT} Backfill...`);

    if (!fs.existsSync(EXCEL_FILE)) {
        console.error(`File not found: ${EXCEL_FILE}`);
        process.exit(1);
    }

    const workbook = XLSX.readFile(EXCEL_FILE);

    // ------------------------------------------------------------------
    // 1. Prepare Sports (Open and Women)
    // ------------------------------------------------------------------
    const sportsMap = new Map<string, string>(); // 'Open' -> uuid, 'Women' -> uuid

    async function ensureSport(name: string): Promise<string> {
        let { data: sport } = await supabase.from('sports').select('id').eq('name', name).single();
        if (!sport) {
            console.log(`Creating sport: ${name}`);
            const { data: newSport, error } = await supabase.from('sports').insert({ name }).select('id').single();
            if (error) throw new Error(`Failed to create sport ${name}: ${error.message}`);
            sport = newSport;
        }
        return sport.id;
    }

    sportsMap.set('Open', await ensureSport(`${SPORT} Open`));
    sportsMap.set('Women', await ensureSport(`${SPORT} Women`));

    const sportIds = Array.from(sportsMap.values());
    console.log('Sports IDs:', Object.fromEntries(sportsMap));

    // ------------------------------------------------------------------
    // 2. Clear Existing Data (Clean Start)
    // ------------------------------------------------------------------
    console.log('\n--- Cleaning Existing Sport Data (Unified) ---');
    // Order: ladder_rank_history -> ratings_history -> matches -> player_profiles

    // 1. Ladder Rank History
    console.log('Deleting ladder_rank_history...');
    const { error: errLRH } = await supabase.from('ladder_rank_history').delete().in('sport_id', sportIds);
    if (errLRH) throw new Error(`Clean LRH Error: ${errLRH.message}`);

    // 2. Ratings History
    const { data: profilesToDelete } = await supabase.from('player_profiles').select('id').in('sport_id', sportIds);
    const profileIds = profilesToDelete?.map(p => p.id) || [];

    if (profileIds.length > 0) {
        console.log(`Deleting ratings_history for ${profileIds.length} profiles...`);
        for (let i = 0; i < profileIds.length; i += 500) {
            const batch = profileIds.slice(i, i + 500);
            const { error: errRH } = await supabase.from('ratings_history').delete().in('player_profile_id', batch);
            if (errRH) throw new Error(`Clean RH Error: ${errRH.message}`);
        }
    }

    // 3. Matches
    console.log('Deleting matches...');
    const { error: errMatches } = await supabase.from('matches').delete().in('sport_id', sportIds);
    if (errMatches) throw new Error(`Clean Matches Error: ${errMatches.message}`);

    // 4. Player Profiles
    console.log('Deleting player_profiles...');
    const { error: errProfiles } = await supabase.from('player_profiles').delete().in('sport_id', sportIds);
    if (errProfiles) throw new Error(`Clean Profiles Error: ${errProfiles.message}`);

    console.log('✅ Clean complete. Starting parsing...');

    // ------------------------------------------------------------------
    // 3. Process Players (Player DB)
    // ------------------------------------------------------------------
    console.log('\n--- Processing Players ---');
    const playerSheet = workbook.Sheets['Player DB'];

    // Get Headers Explicitly (Raw Mode)
    const rawData = XLSX.utils.sheet_to_json(playerSheet, { header: 1, raw: true, defval: null }) as any[][];
    if (rawData.length === 0) { console.log('Player DB empty'); return; }
    const headers = rawData[0];

    // Identify Column Indices
    const emailIdx = headers.indexOf('Email ID');
    const nameIdx = headers.indexOf('Full Name');
    const bracketIdx = headers.indexOf('Bracket');
    const statusIdx = headers.indexOf('Status');
    const rankIdx = headers.indexOf('WEEKLY RANK ->');
    const joinedIdx = headers.indexOf('Ladder Joined On'); // NEW: Join Date
    // NEW: Cohort and Phone
    const cohortIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('cohort'));
    const phoneIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('phone')); // 'Phone Number'

    console.log(`Indices - Email: ${emailIdx}, Cohort: ${cohortIdx}, Phone: ${phoneIdx}`);

    // Identify Weekly Columns
    const weeklyIndices: { idx: number, serial: string, date: Date }[] = [];
    headers.forEach((h, idx) => {
        if (h && typeof h === 'number' && h > 40000) {
            const date = new Date(Math.round((h - 25569) * 864e5));
            weeklyIndices.push({ idx, serial: String(h), date });
        }
    });

    const userMap = new Map<string, any>();
    // Cohort Cache
    const cohortMap = new Map<string, string>(); // Name -> ID

    // V6: Store Inactive Status for Post-RPC Correction
    const inactiveCorrections: any[] = []; // { user_id, sport_id, last_active_rank, deactivated_at }

    async function getCohortId(name: string): Promise<string> {
        if (!name) return null;
        const normalized = name.trim();
        if (cohortMap.has(normalized)) return cohortMap.get(normalized)!;

        // Find existing
        let { data: cohort } = await supabase.from('cohorts').select('id').eq('name', normalized).single();
        if (!cohort) {
            console.log(`Creating cohort: ${normalized}`);
            const { data: newCohort, error } = await supabase.from('cohorts').insert({ name: normalized }).select('id').single();
            if (error) { console.error(`Cohort Error: ${error.message}`); return null; }
            cohort = newCohort;
        }
        cohortMap.set(normalized, cohort.id);
        return cohort.id;
    }

    const playerProfileUpserts: any[] = [];
    const profileUpdates: any[] = []; // Updates for public.profiles (cohort, phone)
    const playerWeeklyHistory: any[] = [];

    // Buffers for ranking logic
    const openPlayers: any[] = [];
    const womenPlayers: any[] = [];

    // --- Optimized User Loading ---
    console.log('Fetching all auth users...');
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !users || users.length === 0) break;
        allUsers.push(...users);
        if (users.length < 1000) break;
        page++;
    }
    allUsers.forEach(u => {
        if (u.email) userMap.set(u.email.toLowerCase(), u);
    });
    console.log(`Loaded ${allUsers.length} users.`);

    let userFoundCount = 0;

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const email = row[emailIdx]?.toString().toLowerCase().trim();
        const fullName = row[nameIdx]?.toString().trim();
        let bracket = row[bracketIdx]?.toString().trim();

        if (!email || !fullName) continue;

        // Sanitize Bracket
        if (!bracket) bracket = 'Open';
        let sportId = sportsMap.get(bracket);
        if (!sportId) {
            if (bracket.toLowerCase().includes('women')) sportId = sportsMap.get('Women');
            else sportId = sportsMap.get('Open');
        }

        // 1. Get/Create User
        let user = userMap.get(email);
        if (!user) {
            console.log(`Creating user: ${email} (${fullName})`);
            const { data: newUser, error } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            });
            if (error) {
                console.error(`Failed to create user ${email}: ${error.message}`);
                continue;
            }
            user = newUser.user;
            userMap.set(email, user);
        }
        userFoundCount++;

        // 2. Prepare Profile Update (Cohort/Phone)
        const cohortName = cohortIdx >= 0 ? row[cohortIdx]?.toString().trim() : null;
        const phone = phoneIdx >= 0 ? row[phoneIdx]?.toString().trim() : null;

        if (cohortName || phone) {
            profileUpdates.push({
                user: user,
                cohortName,
                phone
            });
        }

        // Parse Join Date
        let joinedAt = new Date().toISOString(); // Default to now if missing
        if (joinedIdx >= 0 && row[joinedIdx]) {
            const rawDate = row[joinedIdx];
            if (typeof rawDate === 'number') {
                joinedAt = new Date(Math.round((rawDate - 25569) * 864e5)).toISOString();
            } else {
                const parsed = new Date(rawDate);
                if (!isNaN(parsed.getTime())) joinedAt = parsed.toISOString();
            }
        }

        // 3. Player Profile
        const status = row[statusIdx];
        const isActive = status === 'Active';
        const rawExcelRank = row[rankIdx];

        const payload = {
            user_id: user.id,
            sport_id: sportId,
            rating: 1000,
            matches_played: 0,
            ladder_rank: isActive && rawExcelRank ? rawExcelRank : null, // Default to Excel rank
            deactivated: !isActive,
            deactivated_at: !isActive ? new Date().toISOString() : null,
            last_active_rank: !isActive ? rawExcelRank : null,
            created_at: joinedAt, // NEW: Set creation date from Excel
            _raw_row: row, // Keep ref for sort if needed? Actually we process sequentially.
            _is_women: sportId === sportsMap.get('Women')
        };

        // V6: Collect Inactive Correction
        if (!isActive) {
            inactiveCorrections.push({
                user_id: user.id,
                sport_id: sportId,
                last_active_rank: rawExcelRank || null,
                deactivated_at: payload.deactivated_at // Use the one we just set (now)
            });
        }

        // playerProfileUpserts.push(payload); // We will push after ranking adjustment
        if (payload._is_women) womenPlayers.push(payload);
        else openPlayers.push(payload);

        // 4. Collect Weekly History
        const joinedDateObj = new Date(joinedAt);
        // Reset time part to ensure pure date comparison? Or just use raw timestamp. 
        // Excel dates are noon-ish usually. Let's just compare.

        for (const { idx, date } of weeklyIndices) {
            const rank = row[idx];

            // Check if this week is "active" for the player (after they joined)
            if (date >= joinedDateObj) {
                if (rank) {
                    playerWeeklyHistory.push({
                        user_id: user.id,
                        sport_id: sportId,
                        week_date: date,
                        rank: rank
                    });
                } else {
                    // V5: Missing entry AFTER joining = Deactivated that week -> Rank 0
                    playerWeeklyHistory.push({
                        user_id: user.id,
                        sport_id: sportId,
                        week_date: date,
                        rank: null // 0 indicates deactivated/no-rank
                    });
                }
            }
        }
    }

    // 1. Women: Rank 1..N based on order in Excel (which is preserved in array)
    // Filter actively ranked only? "Rank by index".
    // If they are deactivated, they shouldn't have a rank?
    // User said "rank by index". I'll assume only Active players get a rank.
    // OR does index apply even to inactive?
    // "ladder_rank" column only applies to active.
    let womenRankCounter = 1;
    for (const p of womenPlayers) {
        if (!p.deactivated) {
            p.ladder_rank = womenRankCounter++;
        }
        playerProfileUpserts.push(p);
    }

    // 2. Open: Keep Excel Rank (or use Index?)
    // User didn't complain about Open. We'll trust Excel Rank or Row order?
    // Let's keep Excel Rank for Open as per previous logic.
    // Ensure we push them.
    for (const p of openPlayers) {
        playerProfileUpserts.push(p);
    }

    console.log(`Resolved ${userFoundCount} users from rows.`);
    console.log(`Collected ${playerProfileUpserts.length} profile upserts (${womenPlayers.length} Women, ${openPlayers.length} Open).`);

    // Process Profile Updates (Cohort/Phone)
    console.log(`Processing ${profileUpdates.length} profile metadata updates...`);
    for (const update of profileUpdates) {
        const updates: any = {};
        if (update.phone) updates.contact_number = update.phone;
        if (update.cohortName) {
            const cid = await getCohortId(update.cohortName);
            if (cid) updates.cohort_id = cid;
        }
        if (Object.keys(updates).length > 0) {
            // public.profiles should exist due to trigger on auth.users insert, but let's upsert to be safe
            // Actually 'id' is key.
            await supabase.from('profiles').update(updates).eq('id', update.user.id);
        }
    }

    console.log(`Upserting player_profiles...`);
    // Batch Insert (using upsert for convenience on conflict id if logic retained)
    // Clean payload of temporary keys
    const cleanUpserts = playerProfileUpserts.map(({ _raw_row, _is_women, ...rest }) => rest);

    for (let i = 0; i < cleanUpserts.length; i += 100) {
        const chunk = cleanUpserts.slice(i, i + 100);
        const { error } = await supabase.from('player_profiles').upsert(chunk, { onConflict: 'user_id, sport_id' });
        if (error) console.error('Error upserting chunk:', error.message);
    }

    // ------------------------------------------------------------------
    // EXPLICIT CLEANUP of Trigger-Generated History
    // ------------------------------------------------------------------
    console.log('\n--- Cleaning Trigger-Generated Initial History ---');
    // Triggers add 'Joined Ladder' and 'Initial Rating'. We want to clear them to keep history clean.
    const { error: cleanTriggerLRH } = await supabase.from('ladder_rank_history')
        .delete()
        .in('sport_id', sportIds)
        .eq('reason', 'Joined Ladder');

    if (cleanTriggerLRH) console.error('Error cleaning trigger LRH:', cleanTriggerLRH.message);
    else console.log('✅ Trigger-generated ladder history removed.');

    /* NOTE: Ratings history is truncated/reset by recompute_all_elos_and_history anyway */

    // Re-fetch profiles to get IDs
    const { data: freshProfiles } = await supabase.from('player_profiles').select('id, user_id, sport_id');
    const userToProfileId = new Map<string, string>();
    if (freshProfiles) {
        freshProfiles.forEach(p => userToProfileId.set(`${p.user_id}-${p.sport_id}`, p.id));
    }
    console.log(`Refetched ${freshProfiles?.length || 0} profiles for ID resolution.`);

    // ------------------------------------------------------------------
    // 4. Process Matches (Results Archive)
    // ------------------------------------------------------------------
    console.log('\n--- Processing Matches ---');
    const matchSheet = workbook.Sheets['Results Archive'];
    const matches: any[] = XLSX.utils.sheet_to_json(matchSheet);
    console.log(`Loaded ${matches.length} match rows.`);

    const matchesToInsert: any[] = [];

    // Helper to find ID by Name
    const nameToProfileId = new Map<string, any>();
    for (const [email, user] of userMap.entries()) {
        const name = user.user_metadata?.full_name?.toLowerCase().trim();
        if (name) {
            const profiles = freshProfiles?.filter(p => p.user_id === user.id);
            profiles?.forEach(p => {
                nameToProfileId.set(`${name}-${p.sport_id}`, p.id);
            });
        }
    }

    for (const row of matches) {
        // Valid?
        if (row['Valid?'] === false || row['Valid?'] === 'No') continue;

        const p1Name = row['Challenger Name']?.toString().toLowerCase().trim();
        const p2Name = row['Defender Name']?.toString().toLowerCase().trim();
        let bracket = row['Bracket']?.toString();

        let sportId = sportsMap.get(bracket);
        if (!sportId) {
            if (bracket === 'Women') sportId = sportsMap.get('Women');
            else sportId = sportsMap.get('Open');
        }

        if (!p1Name || !p2Name) continue;
        const p1Id = nameToProfileId.get(`${p1Name}-${sportId}`);
        const p2Id = nameToProfileId.get(`${p2Name}-${sportId}`);

        if (!p1Id || !p2Id) {
            console.warn(`Skipping match: Players not found. ${p1Name} vs ${p2Name} in ${bracket}`);
            continue;
        }

        let matchDate = new Date();
        const dateSerial = row['Date'];
        if (typeof dateSerial === 'number') {
            matchDate = new Date(Math.round((dateSerial - 25569) * 864e5));
        }

        const winner = row['Winner']?.toString().toLowerCase();
        let winnerId = null;
        if (winner === 'challenger') winnerId = p1Id;
        else if (winner === 'defender') winnerId = p2Id;
        else continue;

        matchesToInsert.push({
            sport_id: sportId,
            player1_id: p1Id,
            player2_id: p2Id,
            winner_id: winnerId,
            reported_by: winnerId,
            created_at: matchDate.toISOString(),
            updated_at: matchDate.toISOString(),
            status: 'PROCESSED',
            scores: { raw: row['Scoreline'], imported: true }
        });
    }

    console.log(`Inserting ${matchesToInsert.length} matches...`);
    for (let i = 0; i < matchesToInsert.length; i += 100) {
        const chunk = matchesToInsert.slice(i, i + 100);
        const { error } = await supabase.from('matches').insert(chunk);
        if (error) console.error('Error inserting matches chunk:', error.message);
    }

    // ------------------------------------------------------------------
    // 5. Recompute ELO
    // ------------------------------------------------------------------
    console.log('\n--- Recomputing ELOs (and resetting history) ---');
    const { error: rpcEloError } = await supabase.rpc('recompute_all_elos_and_history');
    if (rpcEloError) console.error('RPC ELO Error:', rpcEloError.message);
    else console.log('✅ ELOs recomputed (ratings_history generated).');

    // ------------------------------------------------------------------
    // 6. Insert Manual Weekly Snapshots
    // ------------------------------------------------------------------
    console.log('\n--- Inserting Weekly Snapshots ---');
    console.log(`Collected ${playerWeeklyHistory.length} history items.`);
    const historyInserts = [];
    for (const item of playerWeeklyHistory) {
        const pid = userToProfileId.get(`${item.user_id}-${item.sport_id}`);
        if (pid) {
            historyInserts.push({
                sport_id: item.sport_id,
                player_profile_id: pid,
                new_rank: item.rank,
                old_rank: null,
                reason: 'Weekly Snapshot (Manual)',
                created_at: item.week_date.toISOString(),
                match_id: null
            });
        }
    }

    console.log(`Inserting ${historyInserts.length} snapshot records...`);
    for (let i = 0; i < historyInserts.length; i += 100) {
        const chunk = historyInserts.slice(i, i + 100);
        const { error } = await supabase.from('ladder_rank_history').insert(chunk);
        if (error) console.error('Error inserting history chunk:', error.message);
    }

    // ------------------------------------------------------------------
    // 7. Cleanup: Delete non-manual ladder history & generated ratings history
    // ------------------------------------------------------------------
    console.log('\n--- Finalizing Cleanup ---');

    // 1. Delete Ladder History where reason NOT LIKE '%(Manual)%'
    // We want to keep 'Weekly Snapshot (Manual)'.
    // We want to delete 'Joined Ladder', 'Rank Shift', etc.
    console.log('Deleting non-manual ladder history...');

    // Check count first
    const { count: preCleanupCount } = await supabase.from('ladder_rank_history')
        .select('*', { count: 'exact', head: true })
        .in('sport_id', sportIds)
        .not('reason', 'ilike', '%(Manual)%');
    console.log(`Found ${preCleanupCount} non-manual entries to delete.`);

    // Execute Delete
    const { error: cleanLH } = await supabase.from('ladder_rank_history')
        .delete()
        .in('sport_id', sportIds)
        .not('reason', 'ilike', '%(Manual)%');

    if (cleanLH) console.error('Error cleaning Ladder History:', cleanLH.message);
    else console.log('✅ Ladder History cleanup executed.');

    // 2. Ratings History (ELO)
    // RPC recomputes everything using profile keys.
    // 'Initial Rating' entries will now have the correct 'created_at' because we set player_profiles.created_at in the upsert.
    // We do not need to delete anything.
    console.log('✅ ELO History Preserved (Initial Rating dates aligned with Join Date via RPC).');

    // Fetch profiles again to be sure
    const { data: profilesToClean } = await supabase.from('player_profiles').select('id').in('sport_id', sportIds);
    const pIds = profilesToClean?.map(p => p.id) || [];

    // Preserve the 'recomputed' and 'Initial Rating' entries generated by the RPC.

    // Double check counts
    const { count: finalRHCount } = await supabase.from('ratings_history')
        .select('*', { count: 'exact', head: true })
        .in('player_profile_id', pIds);
    console.log(`Final ratings_history count: ${finalRHCount} (Should be > 0)`);

    // ------------------------------------------------------------------
    // 8. V6 Correction: Restore Inactive Status (Post-RPC)
    // ------------------------------------------------------------------
    console.log('\n--- V6 Correction: Restoring Inactive Data ---');
    console.log(`Found ${inactiveCorrections.length} inactive profiles to restore.`);

    // RPC recompute might have set them to Active if they had matches, or just left them as is.
    // We want to force them to be Deactivated with correct metadata.

    for (const correction of inactiveCorrections) {
        const { error: deactivateError } = await supabase.from('player_profiles')
            .update({
                deactivated: true,
                ladder_rank: null,
                last_active_rank: correction.last_active_rank,
                deactivated_at: correction.deactivated_at
            })
            .eq('user_id', correction.user_id)
            .eq('sport_id', correction.sport_id);

        if (deactivateError) console.error(`Error deactivating user ${correction.user_id}:`, deactivateError.message);
    }
    console.log('✅ Inactive profiles restored.');

    // Note: We skipped Match Replay (process_ladder_match) so Profile Ranks should be exactly as inserted (Index-based).

    console.log('\n✅ Unified Backfill Complete.');
}

backfill().catch(console.error);
