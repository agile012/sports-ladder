'use server'

import { createClient } from '@/lib/supabase/server'
import { Sport, PlayerProfile, Match, MatchWithPlayers, PendingChallengeItem, RankedPlayerProfile, PlayerProfileExtended } from '@/lib/types'
import { calculateRanks, getChallengablePlayers, getCooldownOpponents } from '@/lib/ladderUtils'
import { getCachedSports, getCachedAllPlayers } from '@/lib/cached-data'

export type DashboardData = {
    sports: Sport[]
    topLists: Record<string, PlayerProfile[]>
    challengeLists: Record<string, RankedPlayerProfile[]>
    recentMatches: MatchWithPlayers[]
    pendingChallenges: PendingChallengeItem[]
    userProfileIds: string[]
    myProfiles: PlayerProfileExtended[] // Updated to Extended to include stats
    unjoinedSports: Sport[]
    verificationStatus: 'pending' | 'verified' | 'rejected' | null
}

export async function getDashboardData(userId?: string): Promise<DashboardData> {
    const supabase = await createClient()

    // Phase 1: Fetch core data in parallel
    // We need: sports, all players (for ranks/names), global recent matches
    const steps: any[] = [
        getCachedSports(),
        getCachedAllPlayers(),
        supabase.from('matches').select('id, sport_id, player1_id, player2_id, winner_id, reported_by, status, created_at, scores, sports(id, name)').order('created_at', { ascending: false }).limit(50)
    ]

    if (userId) {
        // Add user profiles fetch if logged in
        steps.push(supabase.from('player_profiles').select('id, user_id, sport_id, rating, matches_played, ladder_rank, is_admin, created_at, deactivated, deactivated_at, last_active_rank').eq('user_id', userId))
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
            player1: p1 ? { id: p1.id, full_name: p1.full_name, avatar_url: p1.avatar_url, ladder_rank: p1.ladder_rank } : null,
            player2: p2 ? { id: p2.id, full_name: p2.full_name, avatar_url: p2.avatar_url, ladder_rank: p2.ladder_rank } : null,
            winner_id: m.winner_id,
            reported_by: reporter ? { id: reporter.id, full_name: reporter.full_name, avatar_url: reporter.avatar_url } : null,
            status: m.status,
            created_at: m.created_at,
            scores: m.scores,
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
        cutoffDate.setDate(cutoffDate.getDate() - 60) // Fetch enough history for long cooldowns

        const cooldownQuery = supabase
            .from('matches')
            .select('id, sport_id, player1_id, player2_id, created_at, updated_at, status')
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
                    player1: p1 ? {
                        id: p1.id,
                        full_name: p1.full_name || (p1.user_metadata as any)?.full_name || p1.user_email?.split('@')[0] || 'Unknown',
                        avatar_url: p1.avatar_url
                    } : { id: 'unknown', full_name: 'Unknown Player' },
                    player2: p2 ? {
                        id: p2.id,
                        full_name: p2.full_name || (p2.user_metadata as any)?.full_name || p2.user_email?.split('@')[0] || 'Unknown',
                        avatar_url: p2.avatar_url
                    } : { id: 'unknown', full_name: 'Unknown Player' },
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

    // Fetch stats for my profiles
    const myProfilesExtended: any[] = [...userProfiles]
    if (userId && userProfileIds.length > 0) {
        // We can use the global recent matches to calculate simple stats if history is complete,
        // BUT global matches is limited to 50. We need accurate stats.
        // Let's fetch stats count from db or use a separate query.
        // Actually, player_profiles table has 'matches_played'. 'wins' is missing.
        // Let's fetch win counts for these profiles.
        const { data: winCounts } = await supabase
            .from('matches')
            .select('winner_id')
            .in('winner_id', userProfileIds)
            .or('status.eq.CONFIRMED,status.eq.PROCESSED') // Only counted matches

        const winMap = new Map<string, number>()
        winCounts?.forEach((r: any) => {
            winMap.set(r.winner_id, (winMap.get(r.winner_id) || 0) + 1)
        })

        myProfilesExtended.forEach(p => {
            const wins = winMap.get(p.id) || 0
            p.stats = {
                wins,
                losses: p.matches_played - wins,
                winRate: p.matches_played > 0 ? Math.round((wins / p.matches_played) * 100) : 0
            }
        })
    }

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

                // Use shared logic
                const recentOpponentIds = getCooldownOpponents(
                    myRecentMatchesRaw.filter(m => m.sport_id === s.id),
                    myProfile.id,
                    cooldownDays
                )

                // Inject rank into myProfile for the dashboard display
                const rankedProfile = ranked.find(rp => rp.id === myProfile.id)
                const extendedProfile = myProfilesExtended.find(mp => mp.id === myProfile.id)
                if (extendedProfile && rankedProfile) {
                    extendedProfile.ladder_rank = rankedProfile.rank // Sync rank
                }

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

    // Fetch verification status if logged in
    let verificationStatus: 'pending' | 'verified' | 'rejected' | null = null
    if (userId) {
        const { data: profileData } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', userId)
            .single()

        if (profileData) {
            verificationStatus = profileData.status
        }
    }

    return {
        sports,
        topLists,
        challengeLists,
        recentMatches,
        pendingChallenges: pendingChallengesRef,
        userProfileIds,
        myProfiles: myProfilesExtended,
        unjoinedSports,
        verificationStatus
    }
}
