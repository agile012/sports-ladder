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
    { revalidate: 60 } // Reduced from 1 hour to 60s for better responsiveness
)

export const getCachedAllPlayers = unstable_cache(
    async () => {
        const supabase = createDirectClient()
        const { data, error } = await supabase
            .from('player_profiles_view')
            .select('id, user_id, sport_id, rating, matches_played, user_email, user_metadata, full_name, avatar_url, ladder_rank, is_admin, contact_number')
            .order('ladder_rank', { ascending: true, nullsFirst: false })
            .order('rating', { ascending: false })
        if (error) throw error
        return data as PlayerProfile[]
    },
    ['all-players-list'],
    { revalidate: 60, tags: ['all_players'] } // 60 seconds
)

export const getCachedLadder = unstable_cache(
    async (sportId: string) => {
        const supabase = createDirectClient()
        const { data, error } = await supabase
            .from('player_profiles_view')
            .select('id, user_id, sport_id, rating, matches_played, user_email, user_metadata, full_name, avatar_url, ladder_rank, is_admin, contact_number')
            .eq('sport_id', sportId)
            .order('ladder_rank', { ascending: true, nullsFirst: false })
            .order('rating', { ascending: false })
        if (error) throw error
        return data as PlayerProfile[]
    },
    ['sport-ladder'],
    { revalidate: 60 }
)

export const getCachedMatchHistory = unstable_cache(
    async () => {
        const supabase = createDirectClient()
        const { data, count, error } = await supabase
            .from('matches')
            .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at, scores, sports(id, name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(0, 19)

        if (error) throw error
        return { data, count }
    },
    ['match-history-default'],
    { revalidate: 60 }
)
