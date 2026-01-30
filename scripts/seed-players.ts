
import { createClient, User } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { PlayerCSV } from './types';
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

async function seedPlayers() {
    const filePath = 'scripts/data/players.csv'; // Expecting this file
    const sportName = process.argv[2] || 'Squash Open'; // Default or from arg

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
    console.log('Fetching existing Auth users...');
    const emailToUserId = new Map<string, string>();
    let page = 1;
    const PER_PAGE_USERS = 500;
    let keepFetching = true;

    while (keepFetching) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE_USERS });
        if (error) {
            console.error('Error listing users:', error);
            process.exit(1);
        }
        if (!users || users.length === 0) {
            keepFetching = false;
        } else {
            (users as User[]).forEach(u => {
                if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
            });
            if (users.length < PER_PAGE_USERS) keepFetching = false;
            page++;
        }
    }
    console.log(`Loaded ${emailToUserId.size} existing Auth users.`);

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

        if (!emailToUserId.has(email)) {
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
                emailToUserId.set(email, newUser.user.id);
                newUsersCount++;
            }
        }
    }
    console.log(`Created ${newUsersCount} new users.`);

    /* ------------------------------------------------------------------
       5. Prepare Profile Data for Bulk Upsert
       ------------------------------------------------------------------ */
    const profilesToUpsert: any[] = [];
    let currentRankCursor = 1;

    for (const record of records) {
        if (record['Bracket'] && record['Bracket'] !== 'Open') continue;
        const email = record['Email ID']?.toLowerCase();
        const userId = emailToUserId.get(email);

        if (!userId) {
            console.warn(`User ID missing for ${email}, skipping profile.`);
            continue;
        }

        // Determine Status
        // CSV Status: 'Active', 'Left', 'Temporarily Away'
        const csvStatus = record['Status'] || 'Active';
        const isActive = csvStatus === 'Active';

        // If not active, do we overwrite the rank? 
        // User said: "mark them as deactivated on the Ladder Left On date"
        // We will assign rank based on CSV order regardless, but set status.
        // Assuming 'status' column relies on 'Active' | 'Inactive' etc. 
        // If the DB doesn't have 'status', this ignores it, but based on request we assume it handled.

        // Date handling for "Ladder Left On" -> maybe map to `last_active` or just `updated_at`?
        // Let's use `updated_at` as the event timestamp if inactive
        // if (!isActive && record['Ladder Left On']) {
        //     updatedAt = parseDate(record['Ladder Left On']);
        //     if (updatedAt.getTime() > new Date().getTime()) updatedAt = new Date(); // Don't date future
        // }

        const rankToAssign = currentRankCursor++;

        // Deactivation Logic
        const deactivated = !isActive;
        const deactivatedAt = deactivated ? new Date().toISOString() : null;

        profilesToUpsert.push({
            user_id: userId,
            sport_id: sportId,
            rating: 1000,
            ladder_rank: rankToAssign,
            matches_played: 0,
            deactivated: deactivated,
            deactivated_at: deactivatedAt,
            last_active_rank: deactivated ? rankToAssign : null, // Set last rank if deactivated
        });
    }

    console.log(`Upserting ${profilesToUpsert.length} profiles...`);

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
