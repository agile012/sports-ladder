import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Sport, PlayerProfile } from '@/lib/types'

// Setup Direct Client (Public Data Only)
const createDirectClient = () => createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const getCachedSports = unstable_cache(
    async () => {
        const supabase = createDirectClient()
        const { data, error } = await supabase.from('sports').select('id, name, scoring_config').order('name')
        if (error) throw error
        return data as Sport[]
    },
    ['sports-list'],
    { revalidate: 3600 } // 1 hour
)

export const getCachedAllPlayers = unstable_cache(
    async () => {
        const supabase = createDirectClient()
        const { data, error } = await supabase
            .from('player_profiles_view')
            .select('id, user_id, sport_id, rating, matches_played, user_email, user_metadata, full_name, avatar_url, ladder_rank, is_admin')
            .order('ladder_rank', { ascending: true, nullsFirst: false })
            .order('rating', { ascending: false })
        if (error) throw error
        return data as PlayerProfile[]
    },
    ['all-players-list'],
    { revalidate: 60, tags: ['all_players'] } // 60 seconds
)
