import { PlayerProfile, RankedPlayerProfile, ScoringConfig } from '@/lib/types'

/**
 * Calculates ranks for a list of players sorted by rating/matches.
 * Returns the list with 'rank' property added.
 */
export function calculateRanks(players: PlayerProfile[]): RankedPlayerProfile[] {
    // If players have ladder_rank, use it directly as the source of truth for 'rank'.
    // This assumes that if one player has it, they all do (or we default to existing logic).
    if (players.length > 0 && typeof players[0].ladder_rank === 'number') {
        return players.map(p => ({ ...p, rank: p.ladder_rank! }))
    }

    const ranks: number[] = []
    let lastRank = 0
    for (let i = 0; i < players.length; i++) {
        if (i === 0) {
            ranks.push(1)
            lastRank = 1
        } else {
            const prev = players[i - 1]
            // Rank is same if rating is same. 
            // Note: This logic assumes players are already sorted by rating desc!
            if (players[i].rating === prev.rating) {
                ranks.push(lastRank)
            } else {
                ranks.push(i + 1)
                lastRank = i + 1
            }
        }
    }
    return players.map((p, i) => ({ ...p, rank: ranks[i] }))
}

/**
 * Determines the list of players that 'myProfile' can validly challenge.
 * Applies:
 * 1. Challenge Range (Configured or Default)
 * 2. Novice Bonus (Rule 5.1: New players get range 10)
 * 3. Rematch Cooldown (Excludes recent opponents)
 */
export function getChallengablePlayers(
    allPlayers: PlayerProfile[],
    myProfile: PlayerProfile,
    config: ScoringConfig | undefined,
    recentOpponentIds: Set<string> = new Set()
): RankedPlayerProfile[] {
    // 1. Calculate Ranks for everyone (assuming input is sorted by rating)
    const rankedPlayers = calculateRanks(allPlayers)

    const myRankedProfile = rankedPlayers.find(p => p.id === myProfile.id)
    if (!myRankedProfile) return [] // Should not happen if myProfile is in allPlayers

    const myRank = myRankedProfile.rank

    // 2. Determine Range
    let range = config?.max_challenge_range ?? 5 // Default to 5 per IIMA rules
    let below = config?.max_challenge_below ?? 0

    // Rule 5.1: New members (0 matches) can challenge up to 10 places above
    if ((myProfile.matches_played || 0) === 0) {
        range = Math.max(range, 10)
    }

    const minRank = Math.max(1, myRank - range)
    const maxRank = myRank + below

    // 3. Filter
    return rankedPlayers.filter(p =>
        p.id !== myProfile.id &&            // Not myself
        p.rank >= minRank &&                // Within upper range (numeric lower)
        p.rank <= maxRank &&                // Within lower range (numeric higher)
        !recentOpponentIds.has(p.id)        // Not in cooldown
    )
}

/**
 * Helper to extract opponent IDs that are on cooldown or have active challenges.
 * Filters matches by:
 * 1. Status: CONFIRMED, PROCESSED (Cooldown) OR PENDING, CHALLENGED, PROCESSING (Active)
 *    Excludes: CANCELLED, DISPUTED (maybe?)
 * 2. Date: Within cooldownDays
 */
export function getCooldownOpponents(
    matches: { player1_id: string | null, player2_id: string | null, status: string, created_at: string, updated_at?: string | null }[],
    myProfileId: string,
    cooldownDays: number
): Set<string> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - cooldownDays)

    const opponents = new Set<string>()
    const blockingStatuses = ['CONFIRMED', 'PROCESSED', 'PENDING', 'CHALLENGED', 'PROCESSING']

    matches.forEach(m => {
        // Check status
        if (!blockingStatuses.includes(m.status)) return

        const isFinished = ['CONFIRMED', 'PROCESSED'].includes(m.status)

        // Use updated_at for finished matches if available (when match happened), else created_at
        const effectiveDateStr = (isFinished && m.updated_at) ? m.updated_at : m.created_at
        const matchDate = new Date(effectiveDateStr)

        if (isFinished) {
            if (matchDate < cutoff) return // Too old
        }
        // If PENDING, we block it always (prevent duplicates)

        const opponentId = m.player1_id === myProfileId ? m.player2_id : m.player1_id
        if (opponentId) opponents.add(opponentId)
    })

    return opponents
}
