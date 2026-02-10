
import { createClient, User } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function deleteUser(email: string) {
    console.log(`Starting deletion process for user: ${email}`)

    // 1. Get User ID from Auth
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

    // Note: listUsers might be paginated, but for a script this is often okay. 
    // Better: search by email if possible or verify found user.
    // Actually, listUsers doesn't support email filter directly in all versions, 
    // but let's try to find them in the list.

    if (userError) {
        console.error('Error fetching users:', userError)
        return
    }

    const user = (users as User[]).find(u => u.email === email)

    if (!user) {
        console.error(`User with email ${email} not found in Auth.`)
        // Try to find in profiles to see if there's a disconnect, but mostly we rely on Auth ID.
        return
    }

    const userId = user.id
    console.log(`Found User ID: ${userId}`)

    // 2. Get Player Profiles to clean up related data
    const { data: playerProfiles, error: ppError } = await supabase
        .from('player_profiles')
        .select('id')
        .eq('user_id', userId)

    if (ppError) {
        console.error('Error fetching player profiles:', ppError)
        return
    }

    const profileIds = playerProfiles.map(p => p.id)
    console.log(`Found ${profileIds.length} player profiles.`)

    if (profileIds.length > 0) {
        // 3. Delete Related Data (Child Records)

        // Matches (as player 1 or 2)
        // We need to match on ID.
        console.log('Deleting matches...')
        const { error: matchError } = await supabase
            .from('matches')
            .delete()
            .or(`player1_id.in.(${profileIds.join(',')}),player2_id.in.(${profileIds.join(',')})`)

        if (matchError) console.error('Error deleting matches:', matchError)


        // Rank History
        console.log('Deleting rank history...')
        const { error: rankError } = await supabase
            .from('ladder_rank_history')
            .delete()
            .in('player_profile_id', profileIds)
        if (rankError) console.error('Error deleting rank history:', rankError)

        // Rating History
        console.log('Deleting rating history...')
        const { error: ratingError } = await supabase
            .from('ratings_history')
            .delete()
            .in('player_profile_id', profileIds)
        if (ratingError) console.error('Error deleting rating history:', ratingError)

        // Challenges / Pending stuff? 
        // They are in 'matches' table usually, so covered above.

        // 4. Delete Player Profiles
        console.log('Deleting player profiles...')
        const { error: delPpError } = await supabase
            .from('player_profiles')
            .delete()
            .in('id', profileIds)
        if (delPpError) console.error('Error deleting player profiles:', delPpError)
    }

    // 5. Delete Public Profile (metadata)
    console.log('Deleting public profile...')
    const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

    if (profileError) console.error('Error deleting public profile:', profileError)

    // 6. Delete User from Auth
    console.log('Deleting user from Auth...')
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) {
        console.error('Error deleting user from Auth:', authError)
    } else {
        console.log('Successfully deleted user from Auth.')
    }

    console.log('Deletion complete.')
}

const email = process.argv[2]
if (!email) {
    console.error('Please provide an email address as an argument.')
    process.exit(1)
}

deleteUser(email)
