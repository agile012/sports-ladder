import { createClient, User } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { PlayerCSV } from './types';
import dotenv from 'dotenv';

// Load .env.local first (Next.js convention), then fall back to .env
dotenv.config({ path: '.env.local' });
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

async function seedPlayers() {
    const filePath = 'scripts/data/players.csv'; // Expecting this file
    const sportName = 'Squash Open'; // Default or from arg

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        console.log('Please create a CSV file with headers: full_name,email,initial_rank');
        process.exit(1);
    }

    // 1. Get Sport ID
    let { data: sport, error: sportError } = await supabase
        .from('sports')
        .select('id')
        .eq('name', sportName)
        .single();

    if (!sport) {
        console.log(`Sport '${sportName}' not found. Creating it...`);
        const { data: newSport, error: createError } = await supabase
            .from('sports')
            .insert({ name: sportName })
            .select('id')
            .single();

        if (createError || !newSport) {
            console.error(`Error creating sport: ${createError?.message}`);
            process.exit(1);
        }
        sport = newSport;
    }

    const sportId = sport.id;
    console.log(`Using sport: ${sportName} (${sportId})`);

    // 2. Read CSV
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records: PlayerCSV[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    }).filter((r: any) => r['Email ID'] && r['Email ID'].trim() !== '') as PlayerCSV[]; // Filter empty rows

    console.log(`Found ${records.length} players to process.`);

    /* ------------------------------------------------------------------
       3. Pre-fetch All Users (Batched)
       ------------------------------------------------------------------ */
    // 3. Get existing users & profiles
    // We avoid 'player_profiles_view' because it screens out deactivated users.
    // Instead, we fetch Auth Users (for Email/ID) and Player Profiles (Table) and join them.

    // A. Fetch All Auth Users (Pagination handled if needed, default 50 per page usually, strict limit is 1000? 
    // supabase-js listUsers default is 50. We need ALL.
    const allAuthUsers: any[] = [];
    let page = 1;
    let keepFetching = true;
    while (keepFetching) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000, page: page });
        if (error) {
            console.error('Error fetching auth users:', error);
            process.exit(1);
        }
        if (!users || users.length === 0) {
            keepFetching = false;
        } else {
            allAuthUsers.push(...users);
            page++;
            // Safety break if needed for huge lists, but 1000 per page loop is fine
            if (users.length < 1000) keepFetching = false;
        }
    }

    console.log(`Fetched ${allAuthUsers.length} Auth Users.`);

    // B. Fetch All Player Profiles (Raw Table)
    const { data: allProfiles, error: profilesError } = await supabase
        .from('player_profiles')
        .select('*');

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        process.exit(1);
    }
    console.log(`Fetched ${allProfiles?.length} Player Profiles.`);

    // C. Map Email -> { User, Profile }
    const emailToUserMap = new Map<string, { user: any, profile: any }>();
    const userIdToProfileMap = new Map<string, any>();

    if (allProfiles) {
        for (const p of allProfiles) {
            userIdToProfileMap.set(p.user_id, p);
        }
    }

    for (const u of allAuthUsers) {
        if (u.email) {
            const normalizedEmail = u.email.toLowerCase().trim();
            const profile = userIdToProfileMap.get(u.id);
            emailToUserMap.set(normalizedEmail, { user: u, profile: profile });
        }
    }
    /* ------------------------------------------------------------------
       4. Ensure Auth Users Exist (One by One for now, but skipped if exists)
       ------------------------------------------------------------------ */
    let newUsersCount = 0;
    for (const record of records) {
        const email = record['Email ID']?.toLowerCase();
        const fullName = record['Full Name'];
        // Bracket check handled in filtering or here if not filtered
        if (record['Bracket'] && record['Bracket'] !== 'Open') continue;
        if (!email || !fullName) continue;

        const cached = emailToUserMap.get(email);
        const authUserExists = !!cached?.user;

        if (!authUserExists) {
            // Create User
            console.log(`Creating user: ${email}`);
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            });

            if (createError) {
                console.error(`Failed to create user ${email}: ${createError.message}`);
            } else if (newUser.user) {
                // Update map so we can use it below
                emailToUserMap.set(email, { user: newUser.user, profile: null });
                newUsersCount++;
            }
        }
    }
    console.log(`Created ${newUsersCount} new users.`);

    /* ------------------------------------------------------------------
       5. Prepare Profile Data for Bulk Upsert
       ------------------------------------------------------------------ */
    const isRestoreMode = process.argv.includes('--restore-ranks');
    console.log(isRestoreMode
        ? 'Running in RESTORE MODE: Only updating ranks and status. Starting ratings/matches preserved.'
        : 'Running in RESET MODE: Resetting ratings and match counts to defaults.'
    );

    const profilesToUpsert: any[] = [];
    let currentRankCursor = 1;

    for (const record of records) {
        if (record['Bracket'] && record['Bracket'] !== 'Open') continue;
        const email = record['Email ID']?.toLowerCase();

        const cached = emailToUserMap.get(email);
        const userId = cached?.user?.id;

        if (!userId) {
            console.warn(`User ID missing for ${email}, skipping profile.`);
            continue;
        }

        // Determine Status
        // CSV Status: 'Active', 'Left', 'Temporarily Away'
        const csvStatus = record['Status'] || 'Active';
        const isActive = csvStatus === 'Active';

        const rankToAssign = currentRankCursor++;

        // Deactivation Logic
        const deactivated = !isActive;
        const deactivatedAt = deactivated ? new Date().toISOString() : null;

        // Base payload (Primary Keys + Rank/Status)
        const payload: any = {
            user_id: userId,
            sport_id: sportId,
            ladder_rank: deactivated ? null : rankToAssign,
            deactivated: deactivated,
            deactivated_at: deactivatedAt,
            last_active_rank: deactivated ? rankToAssign : null, // Set last rank if deactivated
        };

        // If NOT in restore mode, reset performance metrics
        if (!isRestoreMode) {
            payload.rating = 1000;
            payload.matches_played = 0;
        }

        profilesToUpsert.push(payload);
    }

    console.log(`Upserting ${profilesToUpsert.length} profiles...`);

    // 6. Clear existing ranks to avoid unique constraint violations during reordering
    // If we transform 1->2 and 2->1, standard upsert might fail on intermediate state.
    // Safest way is to set all ranks to null for this sport first.
    console.log('Clearing existing ranks to prevent unique constraint violations...');
    const { error: clearError } = await supabase
        .from('player_profiles')
        .update({ ladder_rank: null })
        .eq('sport_id', sportId);

    if (clearError) {
        console.error('Error clearing ranks:', clearError.message);
        // Process might continue but could fail on upsert
    } else {
        console.log('Ranks cleared successfully.');
    }

    // Bulk Upsert in chunks to avoid payload limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < profilesToUpsert.length; i += CHUNK_SIZE) {
        const chunk = profilesToUpsert.slice(i, i + CHUNK_SIZE);
        const { error: upsertError } = await supabase
            .from('player_profiles')
            .upsert(chunk, {
                onConflict: 'user_id, sport_id',
                ignoreDuplicates: false
            });

        if (upsertError) {
            console.error(`Error upserting chunk ${i}:`, upsertError.message);
        } else {
            console.log(`  - Chunk ${i / CHUNK_SIZE + 1} processed.`);
        }
    }

    console.log('✅ Player seeding complete.');
}

seedPlayers().catch(console.error);
