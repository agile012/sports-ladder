import { Suspense } from 'react'
import LadderPage from './LadderPage'
import { getCachedSports, getCachedLadder } from '@/lib/cached-data'
import { calculateRanks } from '@/lib/ladderUtils'

export default async function Page({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const resolvedParams = await searchParams
  const sports = await getCachedSports()

  let initialPlayers = []
  const initialSportId = resolvedParams.sport || (sports.length > 0 ? sports[0].id : undefined)

  if (initialSportId) {
    const rawPlayers = await getCachedLadder(initialSportId)
    initialPlayers = calculateRanks(rawPlayers)
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading ladder...</div>}>
      <LadderPage
        initialSports={sports}
        initialPlayers={initialPlayers}
        initialSelectedSportId={initialSportId}
      />
    </Suspense>
  )
}
