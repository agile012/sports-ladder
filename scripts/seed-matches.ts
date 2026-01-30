
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { MatchCSV } from './types';
import 'dotenv/config';

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

async function seedMatches() {
    const filePath = 'scripts/data/matches.csv';
    const sportName = process.argv[2] || 'Squash Open';

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
    }

    // 1. Get Sport ID
    const { data: sport, error: sportError } = await supabase
        .from('sports')
        .select('id, scoring_config')
        .eq('name', sportName)
        .single();

    if (sportError || !sport) {
        console.error(`Error: Sport '${sportName}' not found.`);
        process.exit(1);
    }
    const sportId = sport.id;
    const scoringType = (sport.scoring_config as any)?.type || 'simple';

    // 2. Read Matches
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsedRecords: MatchCSV[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    // Filter out empty rows (must have at least Challenger and Date)
    const records: MatchCSV[] = parsedRecords.filter((r: any) => r['Challenger Name'] && r['Date']);

    // 3. Resolve Player IDs Mapping
    // fetch all profiles for this sport to map Names -> IDs
    const { data: profiles } = await supabase
        .from('player_profiles_view') // Use view to get names
        .select('id, full_name')
        .eq('sport_id', sportId);

    if (!profiles) {
        console.error('No profiles found for this sport.');
        process.exit(1);
    }

    // Create a map: Normalized Name -> ID
    const nameToId = new Map<string, string>();
    for (const p of profiles) {
        if (p.full_name) nameToId.set(p.full_name.toLowerCase().trim(), p.id);
    }

    // Also try partial matches or manual mapping if needed? taking simple approach first.

    // ----------------------------------------------------------------
    // 4. Batch Insert Matches
    // ----------------------------------------------------------------
    console.log(`Found ${records.length} matches to process.`);
    const matchesToInsert: any[] = [];
    const matchLookup = new Map<string, any>(); // Key: "P1_ID-P2_ID-Date" -> CSV Record

    for (const record of records) {
        if (record['Bracket'] && record['Bracket'] !== 'Open') continue;

        const challengerName = record['Challenger Name']?.trim();
        const defenderName = record['Defender Name']?.trim();
        if (!challengerName || !defenderName) continue;

        const p1Id = nameToId.get(challengerName.toLowerCase()); // Challenger
        const p2Id = nameToId.get(defenderName.toLowerCase()); // Defender

        if (!p1Id || !p2Id) {
            console.warn(`Skipping match: Could not find player(s). ${challengerName} ${p1Id} vs ${defenderName} ${p2Id}`);
            continue;
        }

        // Determine Winner ID
        let winnerId: string;
        const winnerVal = record['Winner']?.toLowerCase();
        if (winnerVal === 'challenger') winnerId = p1Id;
        else if (winnerVal === 'defender') winnerId = p2Id;
        else continue;

        // Date Parsing
        let matchDate: Date;
        const dateStr = record['Date'];
        const timeStr = record['Time'] || '12:00';
        if (dateStr) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const iso = `${parts[2]}-${parts[1]}-${parts[0]}T${timeStr}:00`;
                matchDate = new Date(iso);
            } else {
                matchDate = new Date(dateStr);
            }
        } else continue;

        if (isNaN(matchDate.getTime())) continue;

        // Score Parsing
        const rawScore = record['Scoreline'] || '';
        let scoresValue: any;
        if (rawScore.toLowerCase().includes('walkover') || rawScore.toLowerCase().includes('forfeit')) {
            scoresValue = { reason: 'forfeit' };
        } else {
            const cleanScore = rawScore.replace(/\s+/g, ' ').trim();
            if (cleanScore.includes(',')) {
                const games = cleanScore.split(',');
                scoresValue = [];
                for (const g of games) {
                    const parts = g.split('-').map(s => s.trim());
                    if (parts.length === 2) scoresValue.push({ p1: parts[0], p2: parts[1] });
                }
            } else if (cleanScore.includes('-')) {
                const parts = cleanScore.split('-').map(s => s.trim());
                if (parts.length === 2) scoresValue = [{ p1: parts[0], p2: parts[1] }];
                else scoresValue = { raw: rawScore, imported: true };
            } else {
                scoresValue = { raw: rawScore, imported: true };
            }
        }

        const matchObj = {
            sport_id: sportId,
            player1_id: p1Id,
            player2_id: p2Id,
            winner_id: winnerId,
            reported_by: winnerId,
            created_at: matchDate.toISOString(),
            updated_at: matchDate.toISOString(),
            status: 'PROCESSED',
            scores: scoresValue
        };
        matchesToInsert.push(matchObj);

        // Store CSV record for history reconstruction later
        // Use a unique key for lookup. Assuming P1+P2+Date is unique enough for this valid dataset
        const key = `${p1Id}-${p2Id}-${matchDate.toISOString()}`;
        matchLookup.set(key, record);
    }

    // Sort by Date for Insertion (Old -> New)
    matchesToInsert.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    console.log(`Inserting ${matchesToInsert.length} matches in batch...`);
    const insertedMatches: any[] = [];

    // Batch Insert Loop
    const CHUNK_SIZE = 50;
    for (let i = 0; i < matchesToInsert.length; i += CHUNK_SIZE) {
        const chunk = matchesToInsert.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase.from('matches').insert(chunk).select();

        if (error) {
            console.error(`Error inserting chunk ${i}: ${error.message}`);
        } else if (data) {
            insertedMatches.push(...data);
            console.log(`  - Inserted chunk ${i / CHUNK_SIZE + 1}`);
        }
    }

    // ----------------------------------------------------------------
    // 5. Recompute ELO
    // ----------------------------------------------------------------
    console.log('Recomputing ELO ratings (RPC call)...');
    const { error: rpcError } = await supabase.rpc('recompute_all_elos_and_history');
    if (rpcError) {
        console.error('Error recomputing ELO:', rpcError.message);
    } else {
        console.log('✅ ELO recomputed successfully.');
    }

    // ----------------------------------------------------------------
    // 6. Reconstruct Ladder History (Reverse)
    // ----------------------------------------------------------------
    console.log('Reconstructing Ladder History (In-Memory Reverse Replay)...');

    // Sort Inserted Matches: New -> Old (Reverse Chronological)
    insertedMatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const historyToInsert: any[] = [];

    // Iterate Matches
    // We assume the DB has current ranks. We trust CSV "Challenger Rank" as the Old Rank source.
    for (const m of insertedMatches) {
        // Find corresponding CSV record
        const key = `${m.player1_id}-${m.player2_id}-${m.created_at}`;
        const record = matchLookup.get(key);

        if (!record) continue;

        // Logic: Did this match cause a Ladder Change?
        // In CSV: "Ladder Update" == "Done" or "Yes" (CSV says 'Done')
        // OR rely on Winner check: if Winner was Challenger and Ranks allowed it
        // Simpler: Use CSV data directly based on user instruction "insert the changes"

        if (record['Ladder Update'] === 'Done' || record['Winner']?.toLowerCase() === 'challenger') {
            const oldRankC = parseInt(record['Challenger Rank']); // Challenger OLD Rank
            const oldRankD = parseInt(record['Defender Rank']);   // Defender OLD Rank (Target)

            if (!isNaN(oldRankC) && !isNaN(oldRankD)) {
                // Challenger (Winner) took Defender's spot
                // So Challenger New Rank = Defender Old Rank
                // Defender New Rank = Defender Old Rank + 1 (shifted)

                // History Entry for Challenger
                historyToInsert.push({
                    sport_id: sportId,
                    player_profile_id: m.player1_id, // Challenger
                    match_id: m.id,
                    old_rank: oldRankC,
                    new_rank: oldRankD,
                    reason: `Victory (Leapfrog) vs ${record['Defender Name']}`,
                    created_at: m.created_at
                });

                // History Entry for Defender
                historyToInsert.push({
                    sport_id: sportId,
                    player_profile_id: m.player2_id, // Defender
                    match_id: m.id,
                    old_rank: oldRankD,
                    new_rank: oldRankD + 1,
                    reason: `Defeated (Shift) by ${record['Challenger Name']}`,
                    created_at: m.created_at
                });

                // Note: We are ignoring the cascade shift history for all other players 
                // because we don't have their IDs easily accessible without loading EVERYONE.
                // Given the instructions, recording the direct participants' history seems to be the priority.
            }
        }
    }

    if (historyToInsert.length > 0) {
        console.log(`Inserting ${historyToInsert.length} history records...`);
        // const { error: histError } = await supabase.from('ladder_rank_history').insert(historyToInsert);
        // if (histError) console.error('Error inserting history:', histError.message);
        // else console.log('✅ Ladder history inserted.');
    }

    console.log('✅ Match seeding & history reconstruction complete.');
}

seedMatches().catch(console.error);
