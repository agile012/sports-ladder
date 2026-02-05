'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createDirectClient } from '@supabase/supabase-js'
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

// CACHED PUBLIC DATA
type PublicDashboardData = {
    sports: Sport[]
    allPlayers: PlayerProfile[]
    recentMatches: MatchWithPlayers[]
    topLists: Record<string, PlayerProfile[]>
    playerMap: Map<string, PlayerProfile> // Not serializable for cache, but we'll rebuild it or return list
}

// Helper to fetch global matches (uncached for freshness)
const getCachedGlobalMatches = async () => {
    const supabase = createDirectClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data, error } = await supabase
        .from('matches')
        .select('id, sport_id, player1_id, player2_id, winner_id, reported_by, status, created_at, scores, sports(id, name)')
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) throw error
    return data || []
}

async function getPublicDashboardData() {
    // Parallel fetch cached data
    const [sports, allPlayers, globalMatchesRaw] = await Promise.all([
        getCachedSports(),
        getCachedAllPlayers(),
        getCachedGlobalMatches()
    ])

    // Map for fast player lookup
    const playerMap = new Map<string, PlayerProfile>()
    allPlayers.forEach(p => playerMap.set(p.id, p))

    // Resolve global matches
    const recentMatches: MatchWithPlayers[] = globalMatchesRaw.map((m: any) => {
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

    // Calculate Top Lists (Ranks)
    const topLists: Record<string, PlayerProfile[]> = {}
    const sportPlayersMap: Record<string, PlayerProfile[]> = {}
    const fullRankedLists: Record<string, RankedPlayerProfile[]> = {}

    // Group players by sport
    allPlayers.forEach(p => {
        if (!sportPlayersMap[p.sport_id]) sportPlayersMap[p.sport_id] = []
        sportPlayersMap[p.sport_id].push(p)
    })

    for (const s of sports) {
        const sPlayers = sportPlayersMap[s.id] || []
        const ranked = calculateRanks(sPlayers) // This might be expensive, good to do in this cached block
        topLists[s.id] = ranked.slice(0, 5)
        fullRankedLists[s.id] = ranked
    }

    return {
        sports,
        allPlayers,
        recentMatches,
        topLists,
        fullRankedLists
    }
}

export async function getDashboardData(userId?: string): Promise<DashboardData> {
    const supabase = await createClient()

    // 1. Fetch Public Data (Fast, Cached)
    const publicData = await getPublicDashboardData()
    const { sports, recentMatches, topLists, fullRankedLists } = publicData

    // 2. Fetch User Specific Data (If logged in)
    let userProfiles: PlayerProfile[] = []
    let pendingChallengesRef: PendingChallengeItem[] = []
    let myRecentMatchesRaw: any[] = []
    let verificationStatus: 'pending' | 'verified' | 'rejected' | null = null

    if (userId) {
        const p1Steps: any[] = [
            supabase.from('player_profiles').select('id, user_id, sport_id, rating, matches_played, ladder_rank, is_admin, created_at, deactivated, deactivated_at, last_active_rank').eq('user_id', userId),
            supabase.from('profiles').select('status').eq('id', userId).single()
        ]

        const [profilesRes, verifyRes] = await Promise.all(p1Steps)

        userProfiles = profilesRes.data || []
        if (verifyRes.data) verificationStatus = verifyRes.data.status

        const userProfileIds = userProfiles.map(p => p.id)

        if (userProfileIds.length > 0) {
            const p2Steps: any[] = []

            // Pending Challenges Matches
            const idsFilter = userProfileIds.join(',')
            const pendingQuery = supabase
                .from('matches')
                .select('id, sport_id, player1_id, player2_id, status, message, action_token, winner_id, reported_by, created_at, scores, sports(scoring_config)')
                .or(`player1_id.in.(${idsFilter}),player2_id.in.(${idsFilter})`)
                .in('status', ['CHALLENGED', 'PENDING', 'PROCESSING'])
                .order('created_at', { ascending: false })
            p2Steps.push(pendingQuery)

            // Cooldown Matches
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - 60)
            const cooldownQuery = supabase
                .from('matches')
                .select('id, sport_id, player1_id, player2_id, created_at, updated_at, status')
                .or(`player1_id.in.(${idsFilter}),player2_id.in.(${idsFilter})`)
                .gt('created_at', cutoffDate.toISOString())
            p2Steps.push(cooldownQuery)

            const [pendingRes, cooldownRes] = await Promise.all(p2Steps)

            if (pendingRes.data) {
                // We need to resolve player names for pending challenges. 
                // Since we have publicData.allPlayers, we can find them there instead of DB joins
                // Optimization: Use the Map we could have returned, or just array find

                // Rebuild map for efficiency here or just array.find which is fast for < 1000 items
                // Let's rely on array.find for now, assuming player count < 10k
                const playerMap = new Map(publicData.allPlayers.map(p => [p.id, p]))

                pendingChallengesRef = (pendingRes.data as any[]).map(m => {
                    const p1 = m.player1_id ? playerMap.get(m.player1_id) : null
                    const p2 = m.player2_id ? playerMap.get(m.player2_id) : null
                    const reporter = m.reported_by ? playerMap.get(m.reported_by) : null

                    return {
                        ...m,
                        sports: m.sports as any,
                        player1: p1 ? {
                            id: p1.id,
                            full_name: p1.full_name || 'Unknown',
                            avatar_url: p1.avatar_url
                        } : { id: 'unknown', full_name: 'Unknown Player' },
                        player2: p2 ? {
                            id: p2.id,
                            full_name: p2.full_name || 'Unknown',
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
    }

    // Calculate Personal Lists (User Specific)
    const challengeLists: Record<string, RankedPlayerProfile[]> = {}
    const unjoinedSports: Sport[] = []
    const userProfileIds = userProfiles.map(p => p.id)

    // Calculate Extended Profiles (Stats)
    const myProfilesExtended: PlayerProfileExtended[] = [...userProfiles]
    if (userId && userProfileIds.length > 0) {
        const { data: winCounts } = await supabase
            .from('matches')
            .select('winner_id')
            .in('winner_id', userProfileIds)
            .or('status.eq.CONFIRMED,status.eq.PROCESSED')

        const winMap = new Map<string, number>()
        winCounts?.forEach((r: any) => {
            winMap.set(r.winner_id, (winMap.get(r.winner_id) || 0) + 1)
        })

        myProfilesExtended.forEach(p => {
            const wins = winMap.get(p.id) || 0
            p.stats = {
                wins,
                losses: p.matches_played - wins,
                winRate: p.matches_played > 0 ? Math.round((wins / p.matches_played) * 100) : 0,
                total: p.matches_played
            }
        })
    }

    // User-specific derivation from public data
    for (const s of sports) {
        if (userId) {
            const myProfile = userProfiles.find(p => p.sport_id === s.id)
            if (myProfile) {
                const ranked = fullRankedLists[s.id] || []
                const cooldownDays = s.scoring_config?.rematch_cooldown_days ?? 7
                const recentOpponentIds = getCooldownOpponents(
                    myRecentMatchesRaw.filter(m => m.sport_id === s.id),
                    myProfile.id,
                    cooldownDays
                )

                // Sync rank
                const rankedProfile = ranked.find(rp => rp.id === myProfile.id)
                const extendedProfile = myProfilesExtended.find(mp => mp.id === myProfile.id)
                if (extendedProfile && rankedProfile) {
                    extendedProfile.ladder_rank = rankedProfile.rank
                }

                challengeLists[s.id] = getChallengablePlayers(ranked, myProfile, s.scoring_config, recentOpponentIds)
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
        myProfiles: myProfilesExtended,
        unjoinedSports,
        verificationStatus
    }
}
