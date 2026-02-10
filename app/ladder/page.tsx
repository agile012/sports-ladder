import { Suspense } from 'react'
import LadderPage from './LadderPage'
import { getCachedSports, getCachedLadder, getCachedRecentMatches } from '@/lib/cached-data'
import { calculateRanks } from '@/lib/ladderUtils'

export default async function Page({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const resolvedParams = await searchParams
  const sports = await getCachedSports()

  let initialPlayers = []
  let initialRecentMap: Record<string, any[]> = {}

  const initialSportId = resolvedParams.sport || (sports.length > 0 ? sports[0].id : undefined)

  if (initialSportId) {
    const [rawPlayers, matchesRaw] = await Promise.all([
      getCachedLadder(initialSportId),
      getCachedRecentMatches(initialSportId)
    ])

    initialPlayers = calculateRanks(rawPlayers)

    // Process recent matches map
    const finalStatuses = ['CONFIRMED', 'PROCESSED']
    matchesRaw?.forEach((m: any) => {
      const p1 = m.player1_id
      const p2 = m.player2_id

      if (p1) {
        if (!initialRecentMap[p1]) initialRecentMap[p1] = []
        if (initialRecentMap[p1].length < 3) {
          const result = finalStatuses.includes(m.status) ? (m.winner_id === p1 ? 'win' : 'loss') : null
          initialRecentMap[p1].push({ id: m.id, result, status: m.status })
        }
      }
      if (p2) {
        if (!initialRecentMap[p2]) initialRecentMap[p2] = []
        if (initialRecentMap[p2].length < 3) {
          const result = finalStatuses.includes(m.status) ? (m.winner_id === p2 ? 'win' : 'loss') : null
          initialRecentMap[p2].push({ id: m.id, result, status: m.status })
        }
      }
    })
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading ladder...</div>}>
      <LadderPage
        initialSports={sports}
        initialPlayers={initialPlayers}
        initialSelectedSportId={initialSportId}
        initialRecentMap={initialRecentMap}
      />
    </Suspense>
  )
}
