import { PlayerProfile, RankedPlayerProfile, ScoringConfig } from '@/lib/types'

/**
 * Calculates ranks for a list of players sorted by rating/matches.
 * Returns the list with 'rank' property added.
 */
export function calculateRanks(players: PlayerProfile[]): RankedPlayerProfile[] {
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

    // Rule 5.1: New members (0 matches) can challenge up to 10 places above
    if ((myProfile.matches_played || 0) === 0) {
        range = Math.max(range, 10)
    }

    const minRank = Math.max(1, myRank - range)

    // 3. Filter
    return rankedPlayers.filter(p =>
        p.id !== myProfile.id &&            // Not myself
        p.rank < myRank &&                  // Strictly above me
        p.rank >= minRank &&                // Within range
        !recentOpponentIds.has(p.id)        // Not in cooldown
    )
}
