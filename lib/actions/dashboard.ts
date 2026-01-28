'use server'

import { createClient } from '@/lib/supabase/server'
import { Sport, PlayerProfile, Match, MatchWithPlayers, PendingChallengeItem, RankedPlayerProfile } from '@/lib/types'
import { calculateRanks, getChallengablePlayers } from '@/lib/ladderUtils'
import { getCachedSports, getCachedAllPlayers } from '@/lib/cached-data'

export type DashboardData = {
    sports: Sport[]
    topLists: Record<string, PlayerProfile[]>
    challengeLists: Record<string, RankedPlayerProfile[]>
    recentMatches: MatchWithPlayers[]
    pendingChallenges: PendingChallengeItem[]
    userProfileIds: string[]
    unjoinedSports: Sport[]
}

export async function getDashboardData(userId?: string): Promise<DashboardData> {
    const supabase = await createClient()

    // Phase 1: Fetch core data in parallel
    // We need: sports, all players (for ranks/names), global recent matches
    const steps: any[] = [
        getCachedSports(),
        getCachedAllPlayers(),
        supabase.from('matches').select('id, sport_id, player1_id, player2_id, winner_id, reported_by, status, created_at, sports(id, name)').order('created_at', { ascending: false }).limit(50)
    ]

    if (userId) {
        // Add user profiles fetch if logged in
        steps.push(supabase.from('player_profiles').select('id, user_id, sport_id, rating, matches_played, ladder_rank, is_admin').eq('user_id', userId))
    }

    const results = await Promise.all(steps)

    const sports = results[0] as Sport[]
    const allPlayers = results[1] as PlayerProfile[]
    const globalMatchesRes = results[2]
    const userProfilesRes = userId ? results[3] : { data: [] }

    // Cached items throw their own errors inside the unstable_cache function wrapper

    const globalMatchesRaw = (globalMatchesRes.data as any[]) || []
    const userProfiles = (userProfilesRes.data as PlayerProfile[]) || []
    const userProfileIds = userProfiles.map(p => p.id)

    // Map for fast player lookup
    const playerMap = new Map<string, PlayerProfile>()
    allPlayers.forEach(p => playerMap.set(p.id, p))

    // Resolve global matches
    const recentMatches: MatchWithPlayers[] = globalMatchesRaw.map(m => {
        const p1 = m.player1_id ? playerMap.get(m.player1_id) : null
        const p2 = m.player2_id ? playerMap.get(m.player2_id) : null
        const reporter = m.reported_by ? playerMap.get(m.reported_by) : null

        return {
            id: m.id,
            sport_id: m.sport_id,
            sport_name: m.sports?.name || null,
            player1: p1 ? { id: p1.id, full_name: p1.full_name, avatar_url: p1.avatar_url } : null,
            player2: p2 ? { id: p2.id, full_name: p2.full_name, avatar_url: p2.avatar_url } : null,
            winner_id: m.winner_id,
            reported_by: reporter ? { id: reporter.id, full_name: reporter.full_name, avatar_url: reporter.avatar_url } : null,
            status: m.status,
            created_at: m.created_at,
        }
    })

    // Phase 2: User specific data (if logged in and has profiles)
    let pendingChallengesRef: PendingChallengeItem[] = []
    let myRecentMatchesRaw: any[] = []

    if (userId && userProfileIds.length > 0) {
        const p2Steps: any[] = []

        // 1. Pending Challenges
        // Finding matches where player1 or player2 is in userProfileIds AND status in [CHALLENGED, PENDING, PROCESSING]
        const idsFilter = userProfileIds.join(',')
        const pendingQuery = supabase
            .from('matches')
            .select('id, sport_id, player1_id, player2_id, status, message, action_token, winner_id, reported_by, created_at, scores, sports(scoring_config)')
            .or(`player1_id.in.(${idsFilter}),player2_id.in.(${idsFilter})`)
            .in('status', ['CHALLENGED', 'PENDING', 'PROCESSING'])
            .order('created_at', { ascending: false })

        p2Steps.push(pendingQuery)

        // 2. Recent matches for cooldown calc
        // We need recent matches for the user's profiles to calculate cooldowns
        // Just fetch last 20 matches involving user, that should cover most cooldown periods (usually 7 days)
        // We can filter more strictly by date in JS or simple query
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 14) // Safety buffer, usually 7 days

        const cooldownQuery = supabase
            .from('matches')
            .select('id, sport_id, player1_id, player2_id, created_at, status')
            .or(`player1_id.in.(${idsFilter}),player2_id.in.(${idsFilter})`)
            .gt('created_at', cutoffDate.toISOString())

        p2Steps.push(cooldownQuery)

        const p2Results = await Promise.all(p2Steps)
        const pendingRes = p2Results[0]
        const cooldownRes = p2Results[1]

        if (pendingRes.data) {
            const pendingRaw = pendingRes.data as any[]
            pendingChallengesRef = pendingRaw.map(m => {
                const p1 = m.player1_id ? playerMap.get(m.player1_id) : null
                const p2 = m.player2_id ? playerMap.get(m.player2_id) : null
                const reporter = m.reported_by ? playerMap.get(m.reported_by) : null

                return {
                    ...m,
                    // casting sports because of type definition mismatches in existing codebase
                    sports: m.sports as any,
                    player1: p1 ? { id: p1.id, full_name: p1.full_name, avatar_url: p1.avatar_url } : { id: 'unknown' },
                    player2: p2 ? { id: p2.id, full_name: p2.full_name, avatar_url: p2.avatar_url } : { id: 'unknown' },
                    reported_by: reporter ? { id: reporter.id } : null
                }
            })
        }

        if (cooldownRes.data) {
            myRecentMatchesRaw = cooldownRes.data
        }
    }

    // Calculate Lists
    const topLists: Record<string, PlayerProfile[]> = {}
    const challengeLists: Record<string, RankedPlayerProfile[]> = {}
    const unjoinedSports: Sport[] = []

    // Helper to find ranks
    const sportPlayersMap: Record<string, PlayerProfile[]> = {}

    // Group players by sport
    allPlayers.forEach(p => {
        if (!sportPlayersMap[p.sport_id]) sportPlayersMap[p.sport_id] = []
        sportPlayersMap[p.sport_id].push(p)
    })

    for (const s of sports) {
        const sPlayers = sportPlayersMap[s.id] || []
        // already sorted by rating desc in fetch
        const ranked = calculateRanks(sPlayers)
        topLists[s.id] = ranked.slice(0, 5)

        if (userId) {
            const myProfile = userProfiles.find(p => p.sport_id === s.id)
            if (myProfile) {
                // Calculate cooldowns
                const cooldownDays = s.scoring_config?.rematch_cooldown_days ?? 7
                const cutoff = new Date()
                cutoff.setDate(cutoff.getDate() - cooldownDays)

                const recentOpponentIds = new Set<string>()
                myRecentMatchesRaw
                    .filter(m => m.sport_id === s.id && new Date(m.created_at) > cutoff)
                    .forEach(m => {
                        if (m.player1_id === myProfile.id) recentOpponentIds.add(m.player2_id)
                        else if (m.player2_id === myProfile.id) recentOpponentIds.add(m.player1_id)
                    })

                const challengables = getChallengablePlayers(ranked, myProfile, s.scoring_config, recentOpponentIds)
                challengeLists[s.id] = challengables
            } else {
                challengeLists[s.id] = []
            }
        } else {
            challengeLists[s.id] = []
        }
    }

    if (userId) {
        const joinedIds = userProfiles.map(p => p.sport_id)
        unjoinedSports.push(...sports.filter(s => !joinedIds.includes(s.id)))
    } else {
        unjoinedSports.push(...sports)
    }

    return {
        sports,
        topLists,
        challengeLists,
        recentMatches,
        pendingChallenges: pendingChallengesRef,
        userProfileIds,
        unjoinedSports
    }
}
