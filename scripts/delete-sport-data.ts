
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
    return new Promise(resolve => rl.question(query, resolve));
};

async function deleteSportData() {
    const args = process.argv.slice(2);
    let sportName = args[0];

    if (!sportName) {
        sportName = await askQuestion('Enter Sport Name (partial match allowed): ');
    }

    if (!sportName) {
        console.error('Sport name required.');
        rl.close();
        process.exit(1);
    }

    console.log(`Searching for sport matching: "${sportName}"...`);
    const { data: sports, error: sportError } = await supabase.from('sports')
        .select('*')
        .ilike('name', `%${sportName}%`);

    if (sportError || !sports || sports.length === 0) {
        console.error('Error finding sport:', sportError?.message || 'Sport not found.');
        rl.close();
        process.exit(1);
    }

    let sport = sports[0];
    if (sports.length > 1) {
        console.log(`\nFound ${sports.length} sports matching "${sportName}":`);
        sports.forEach((s, i) => console.log(`${i + 1}. ${s.name} (ID: ${s.id})`));

        const answer = await askQuestion('\nEnter the number of the sport to delete (or 0 to cancel): ');
        const index = parseInt(answer) - 1;

        if (isNaN(index) || index < 0 || index >= sports.length) {
            console.log('Cancelled.');
            rl.close();
            process.exit(0);
        }
        sport = sports[index];
    }

    console.log(`\n⚠ WARNING: You are about to DELETE ALL DATA for sport:`);
    console.log(`Use this to wipe a sport clean before a fresh backfill.`);
    console.log(`ID: ${sport.id}`);
    console.log(`Name: ${sport.name}`);
    console.log(`\nDeleting:`);
    console.log(`- Ladder Rank History`);
    console.log(`- Ratings History`);
    console.log(`- Matches`);
    console.log(`- Player Profiles`);

    const confirm = await askQuestion('\nType "DELETE" to confirm: ');
    if (confirm !== 'DELETE') {
        console.log('Cancelled.');
        rl.close();
        process.exit(0);
    }

    console.log('\nStarting deletion...');

    // 1. Ladder History
    const { error: lhError, count: lhCount } = await supabase.from('ladder_rank_history')
        .delete({ count: 'exact' })
        .eq('sport_id', sport.id);
    if (lhError) console.error('Error deleting Ladder History:', lhError.message);
    else console.log(`✅ Deleted ${lhCount} Ladder History entries.`);

    // 2. Ratings History (Needs Profile IDs or Join)
    const { data: profiles } = await supabase.from('player_profiles').select('id').eq('sport_id', sport.id);
    const pIds = profiles?.map(p => p.id) || [];

    if (pIds.length > 0) {
        // Delete in chunks to avoid timeout if huge
        const chunkSize = 100;
        let deletedRH = 0;
        for (let i = 0; i < pIds.length; i += chunkSize) {
            const batch = pIds.slice(i, i + chunkSize);
            const { error: rhError, count: rhCount } = await supabase.from('ratings_history')
                .delete({ count: 'exact' })
                .in('player_profile_id', batch);

            if (rhError) console.error('Error deleting Ratings History chunk:', rhError.message);
            else deletedRH += (rhCount || 0);
        }
        console.log(`✅ Deleted ${deletedRH} Ratings History entries.`);
    }

    // 3. Matches
    const { error: matchError, count: matchCount } = await supabase.from('matches')
        .delete({ count: 'exact' })
        .eq('sport_id', sport.id);
    if (matchError) console.error('Error deleting Matches:', matchError.message);
    else console.log(`✅ Deleted ${matchCount} Matches.`);

    // 4. Player Profiles
    const { error: ppError, count: ppCount } = await supabase.from('player_profiles')
        .delete({ count: 'exact' })
        .eq('sport_id', sport.id);
    if (ppError) console.error('Error deleting Player Profiles:', ppError.message);
    else console.log(`✅ Deleted ${ppCount} Player Profiles.`);

    // 5. Sport
    const { error: sError, count: sCount } = await supabase.from('sports')
        .delete({ count: 'exact' })
        .eq('id', sport.id);
    if (sError) console.error('Error deleting Sport:', sError.message);
    else console.log(`✅ Deleted Sport: ${sport.name}`);

    console.log('\n✅ Delete Complete.');
    rl.close();
    process.exit(0);
}

deleteSportData().catch(e => {
    console.error(e);
    rl.close();
    process.exit(1);
});
