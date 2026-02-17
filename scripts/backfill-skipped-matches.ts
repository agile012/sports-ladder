
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
const CSV_FILE = `scripts/data/skipped_matches_${SPORT}.csv`;

async function backfillSkipped() {
    console.log(`Starting Skipped Matches Backfill for ${SPORT}...`);

    if (!fs.existsSync(CSV_FILE)) {
        console.error(`File not found: ${CSV_FILE}`);
        process.exit(1);
    }

    // Read CSV (Assume it has headers)
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const rows = fileContent.split('\n').map(line => {
        // Simple CSV parse handling quotes
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return matches?.map(m => m.replace(/^"|"$/g, '').trim()) || [];
    }).filter(r => r.length > 0);

    if (rows.length < 2) {
        console.log('No data found in CSV.');
        return;
    }

    const headers = rows[0].map(h => h.toLowerCase());
    const data = rows.slice(1);

    const challengerIdx = headers.indexOf('challenger');
    const defenderIdx = headers.indexOf('defender');
    const bracketIdx = headers.indexOf('bracket');
    const dateIdx = headers.indexOf('date');
    const winnerIdx = headers.indexOf('winner');
    const scoreIdx = headers.indexOf('scoreline');

    if (challengerIdx === -1 || defenderIdx === -1) {
        console.error('CSV must have "Challenger" and "Defender" columns (emails).');
        return;
    }

    // Fetch Sports
    const { data: sports } = await supabase.from('sports').select('id, name');
    const sportsMap = new Map<string, string>();
    sports?.forEach(s => {
        if (s.name === `${SPORT} Open`) sportsMap.set('Open', s.id);
        if (s.name === `${SPORT} Women`) sportsMap.set('Women', s.id);
    });

    console.log('Sports IDs:', Object.fromEntries(sportsMap));

    // Fetch All Users for Email Lookup
    const userMap = new Map<string, string>(); // Email -> UserID
    console.log('Fetching all users...');
    let page = 1;
    while (true) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !users || users.length === 0) break;
        users.forEach(u => {
            if (u.email) userMap.set(u.email.toLowerCase(), u.id);
        });
        if (users.length < 1000) break;
        page++;
    }
    console.log(`Loaded ${userMap.size} users.`);

    // Fetch Profiles to Map UserID + SportID -> ProfileID
    const { data: profiles } = await supabase.from('player_profiles').select('id, user_id, sport_id');
    const profileMap = new Map<string, string>(); // "userid-sportid" -> profileid
    profiles?.forEach(p => {
        profileMap.set(`${p.user_id}-${p.sport_id}`, p.id);
    });

    const matchesToInsert: any[] = [];

    for (const row of data) {
        if (row.length < headers.length) continue;

        const p1Email = row[challengerIdx].toLowerCase();
        const p2Email = row[defenderIdx].toLowerCase();
        const bracket = row[bracketIdx];
        const dateStr = row[dateIdx];
        const winner = row[winnerIdx].toLowerCase();
        const scoreline = row[scoreIdx];

        let sportId = sportsMap.get(bracket);
        if (!sportId) {
            if (bracket === 'Women') sportId = sportsMap.get('Women');
            else sportId = sportsMap.get('Open');
        }
        if (!sportId) {
            console.warn(`Unknown bracket: ${bracket}`);
            continue;
        }

        const p1UserId = userMap.get(p1Email);
        const p2UserId = userMap.get(p2Email);

        if (!p1UserId || !p2UserId) {
            console.warn(`User not found for keys: ${p1Email} (${!!p1UserId}), ${p2Email} (${!!p2UserId})`);
            continue;
        }

        const p1ProfileId = profileMap.get(`${p1UserId}-${sportId}`);
        const p2ProfileId = profileMap.get(`${p2UserId}-${sportId}`);

        if (!p1ProfileId || !p2ProfileId) {
            // Create profile if missing? Maybe better to warn.
            // If backfill ran correctly, profiles should exist for registered users.
            console.warn(`Profile not found for users in sport ${sportId}: ${p1Email}, ${p2Email}`);
            continue;
        }

        let winnerId = null;
        if (winner === 'challenger') winnerId = p1ProfileId;
        else if (winner === 'defender') winnerId = p2ProfileId;

        // Parse Date
        let matchDate = new Date();
        // Try parsing ISO or serial
        const serial = parseFloat(dateStr);
        if (!isNaN(serial) && serial > 40000) {
            matchDate = new Date(Math.round((serial - 25569) * 864e5));
        } else {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) matchDate = parsed;
        }

        matchesToInsert.push({
            sport_id: sportId,
            player1_id: p1ProfileId,
            player2_id: p2ProfileId,
            winner_id: winnerId,
            reported_by: winnerId,
            created_at: matchDate.toISOString(),
            updated_at: matchDate.toISOString(),
            status: 'PROCESSED',
            scores: { raw: scoreline, imported: true }
        });
    }

    console.log(`Inserting ${matchesToInsert.length} matches...`);
    for (let i = 0; i < matchesToInsert.length; i += 100) {
        const chunk = matchesToInsert.slice(i, i + 100);
        const { error } = await supabase.from('matches').insert(chunk);
        if (error) console.error('Error inserting chunk:', error.message);
    }

    console.log('\n--- Recomputing ELOs ---');
    const { error: rpcError } = await supabase.rpc('recompute_all_elos_and_history');
    if (rpcError) console.error('RPC Error:', rpcError.message);
    else console.log('✅ ELOs recomputed.');

    console.log('✅ Skipped matches import complete.');
}

backfillSkipped().catch(console.error);
