'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedSports, getCachedAllPlayers } from '@/lib/cached-data'
import { PlayerProfileExtended, Sport, PlayerProfile, PlayerStats, RankInfo, MatchHistoryItem, PendingChallengeItem, RatingHistoryItem, PlayerBasic } from '@/lib/types'

export async function getProfilePageData(userId: string) {
    const supabase = await createClient()

    // 1. Fetch User Profiles and Cached Metadata in parallel
    const [userProfilesRes, sports, allPlayers] = await Promise.all([
        supabase
            .from('player_profiles_view')
            .select('id, user_id, sport_id, rating, matches_played, full_name, avatar_url, is_admin, deactivated, deactivated_at, last_active_rank')
            .eq('user_id', userId)
            .order('rating', { ascending: false }),
        getCachedSports(),
        getCachedAllPlayers()
    ])

    const profiles = (userProfilesRes.data as PlayerProfile[]) || []
    if (profiles.length === 0) return { profiles: [], isAdmin: false }

    const profileIds = profiles.map(p => p.id)
    const idsFilter = profileIds.join(',')
    const sportMap = sports.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>)

    // 2. Bulk Fetch Related Data (Matches, Challenges, History)
    const [matchesRes, pendingRes, historyRes, rankHistoryRes] = await Promise.all([
        // Get last ~10 matches for each profile combined (approx limit 5 * num_profiles, or just 50 global)
        supabase
            .from('matches')
            .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at, scores, sports(name)')
            .or(`player1_id.in.(${idsFilter}),player2_id.in.(${idsFilter})`)
            .order('created_at', { ascending: false }),
        // .limit(50), -- limit if website becomes too slow

        // Pending/Active Challenges
        supabase
            .from('matches')
            .select('id, sport_id, player1_id, player2_id, status, message, action_token, winner_id, reported_by, created_at, scores, sports(scoring_config)')
            .or(`player1_id.in.(${idsFilter}),player2_id.in.(${idsFilter})`)
            .in('status', ['CHALLENGED', 'PENDING', 'PROCESSING']),

        // Rating History (5 per profile approx)
        supabase
            .from('ratings_history')
            .select('player_profile_id, new_rating, created_at')
            .in('player_profile_id', profileIds)
            .order('created_at', { ascending: false }),

        // Rank History
        supabase
            .from('ladder_rank_history')
            .select('player_profile_id, match_id, old_rank, new_rank, reason, created_at')
            .in('player_profile_id', profileIds)
            .order('created_at', { ascending: false })
    ])

    const matchesRaw = matchesRes.data || []
    const pendingRaw = pendingRes.data || []
    const historyRaw = historyRes.data || []
    const rankHistoryRaw = rankHistoryRes.data || []

    // Pre-process all players map for quick lookup
    const playerMap = new Map<string, PlayerProfile>()
    allPlayers.forEach(p => playerMap.set(p.id, p))

    // Helper to resolving basic player info
    const resolvePlayer = (id: string | null): PlayerBasic | null => {
        if (!id) return null
        const p = playerMap.get(id)
        return p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : { id }
    }

    // 3. Assemble Extended Profiles
    const myPlayers: PlayerProfileExtended[] = profiles.map(p => {
        const pId = p.id
        const sportPlayers = allPlayers.filter(ap => ap.sport_id === p.sport_id)

        // A. Rank Info (In-Memory)
        // Players are already sorted by rating desc in cached list
        // Handle ties if needed, or just index
        const rankIndex = sportPlayers.findIndex(x => x.id === pId)
        const rankInfo: RankInfo = {
            rank: rankIndex >= 0 ? rankIndex + 1 : null,
            total: sportPlayers.length
        }

        // B. Recent Matches
        // Filter from bulk matches
        const myMatches = matchesRaw.filter(m => m.player1_id === pId || m.player2_id === pId).slice(0, 5)

        // Convert to MatchHistoryItem
        const recentMatches: MatchHistoryItem[] = myMatches.map(m => {
            const isP1 = m.player1_id === pId
            const opponentId = isP1 ? m.player2_id : m.player1_id
            let result: 'win' | 'loss' | null = null
            if (m.winner_id) result = m.winner_id === pId ? 'win' : 'loss'

            return {
                id: m.id,
                created_at: m.created_at,
                status: m.status,
                result,
                sport_id: m.sport_id,
                sport_name: sportMap[m.sport_id],
                player1_id: m.player1_id,
                player2_id: m.player2_id,
                winner_id: m.winner_id,
                scores: m.scores,
                opponent: resolvePlayer(opponentId)
            }
        })

        // D. Pending Challenges
        const myPending = pendingRaw.filter(pc => pc.player1_id === pId || pc.player2_id === pId).map(pc => ({
            ...pc,
            sports: pc.sports as any, // Cast to any to avoid type issues with limited selection
            player1: resolvePlayer(pc.player1_id)!,
            player2: resolvePlayer(pc.player2_id)!,
            reported_by: pc.reported_by ? { id: pc.reported_by } : null
        })) as PendingChallengeItem[]

        // E. Rating History
        const myHistory = historyRaw
            .filter(h => h.player_profile_id === pId)
            .map(h => ({
                created_at: h.created_at,
                new_rating: h.new_rating
            })) as RatingHistoryItem[]

        return {
            ...p,
            sport_name: sportMap[p.sport_id],
            rankInfo,
            recentMatches,
            pendingChallenges: myPending,
            ratingHistory: myHistory,
            rankHistory: rankHistoryRaw.filter(rh => rh.player_profile_id === pId).map(rh => ({
                created_at: rh.created_at,
                new_rank: rh.new_rank,
                old_rank: rh.old_rank,
                reason: rh.reason
            })),
            stats: { total: p.matches_played ?? 0, wins: 0, losses: 0, winRate: 0 } // Filled in next step
        }
    })

    // 2.5 Stats Filling
    // Efficiently get wins/losses for all profiles
    // We need to count matches where user is winner vs loser
    const { data: allUserMatches } = await supabase
        .from('matches')
        .select('winner_id, player1_id, player2_id, status')
        .or(`player1_id.in.(${idsFilter}),player2_id.in.(${idsFilter})`)
        .in('status', ['PROCESSED']) // Only finished matches count for stats

    if (allUserMatches) {
        const winsMap = new Map<string, number>()
        const totalMap = new Map<string, number>()

        allUserMatches.forEach(m => {
            // Find which profile participated
            // A user might have multiple profiles, usually unique by sport.
            // matches don't cross sports.
            // We can match by ID.
            if (profileIds.includes(m.player1_id!)) {
                const pid = m.player1_id!
                totalMap.set(pid, (totalMap.get(pid) || 0) + 1)
                if (m.winner_id === pid) winsMap.set(pid, (winsMap.get(pid) || 0) + 1)
            }
            if (profileIds.includes(m.player2_id!)) {
                const pid = m.player2_id!
                totalMap.set(pid, (totalMap.get(pid) || 0) + 1)
                if (m.winner_id === pid) winsMap.set(pid, (winsMap.get(pid) || 0) + 1)
            }
        })

        myPlayers.forEach(p => {
            const wins = winsMap.get(p.id) || 0
            const total = totalMap.get(p.id) || p.matches_played // Fallback to view
            const losses = total - wins
            p.stats = {
                total,
                wins,
                losses,
                winRate: total > 0 ? Math.round((wins / total) * 100) : 0
            }
        })
    }

    // Sort by sport name
    myPlayers.sort((a, b) => (a.sport_name || '').localeCompare(b.sport_name || ''))

    const isAdmin = profiles.some(p => p.is_admin)

    return { profiles: myPlayers, isAdmin }
}
