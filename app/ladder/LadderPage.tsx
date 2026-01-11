
'use client'
import { useEffect, useState, useMemo, createRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'
import RankingsTable from '@/components/rankings/RankingsTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sport, RankedPlayerProfile } from '@/lib/types'
import { toast } from "sonner"
import { calculateRanks, getChallengablePlayers } from '@/lib/ladderUtils'

export default function LadderPage() {
  const { user, loading } = useUser()
  const { sports, getPlayersForSport, getUserProfileForSport, createChallenge, getRecentMatchesForProfiles, getMatchesSince } = useLadders()
  const [players, setPlayers] = useState<RankedPlayerProfile[]>([])
  const [recentMap, setRecentMap] = useState<Record<string, any[]>>({})
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null)
  const [challengables, setChallengables] = useState<Set<string>>(new Set())
  const [submittingChallenge, setSubmittingChallenge] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerRefs = useMemo(() => Array(players.length).fill(0).map(() => createRef<HTMLTableRowElement>()), [players])

  // when sports are available, set selected sport from query param if present
  useEffect(() => {
    const sportParam = searchParams.get('sport')
    if (!sportParam || sports.length === 0) return

    const found = sports.find(s => s.id === sportParam)
    if (found) setSelectedSport(found)
  }, [sports, searchParams])

  // fetch players when selected sport changes
  useEffect(() => {
    if (!selectedSport) return
    let cancelled = false

      ; (async () => {
        const pRaw = await getPlayersForSport(selectedSport.id)
        if (cancelled) return

        const p = calculateRanks(pRaw)
        setPlayers(p)

        try {
          const ids = p.map(x => x.id)
          const map = await getRecentMatchesForProfiles(ids, 3)
          if (!cancelled) setRecentMap(map)
        } catch (e) {
          // ignore
        }

        if (!user) {
          setChallengables(new Set())
          return
        }

        const myProfile = await getUserProfileForSport(user.id, selectedSport.id)
        if (!myProfile) {
          setChallengables(new Set())
          return
        }

        const cooldownDays = selectedSport.scoring_config?.rematch_cooldown_days ?? 7

        // Fetch matches specific to cooldown period
        const recentMatches = await getMatchesSince(myProfile.id, cooldownDays)

        const recentOpponentIds = new Set(
          recentMatches
            .map((m: any) => m.opponent?.id)
            .filter(Boolean) as string[]
        )

        // Use shared logic
        const validOpponents = getChallengablePlayers(p, myProfile, selectedSport.scoring_config, recentOpponentIds)

        if (!cancelled) {
          setChallengables(new Set(validOpponents.map(x => x.id)))
        }
      })()

    return () => {
      cancelled = true
    }
  }, [selectedSport, user, getPlayersForSport, getUserProfileForSport, getMatchesSince])

  useEffect(() => {
    const profileId = searchParams.get('profile')
    if (profileId && players.length > 0) {
      const playerIndex = players.findIndex(p => p.id === profileId)
      if (playerIndex !== -1) {
        playerRefs[playerIndex].current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [players, searchParams, playerRefs])

  const ranks = useMemo(() => {
    return players.map(p => p.rank)
  }, [players])

  async function handleChallenge(opponentProfileId: string) {
    if (!selectedSport || !user) {
      router.push('/login')
      return
    }

    const myProfile = await getUserProfileForSport(user.id, selectedSport.id)
    if (!myProfile) {
      toast.error('Join this sport before challenging someone.')
      return
    }

    if (!challengables.has(opponentProfileId)) {
      toast.error('You cannot challenge this player.')
      return
    }

    setSubmittingChallenge(opponentProfileId)

    try {
      await createChallenge(selectedSport.id, myProfile.id, opponentProfileId)
      toast.success('Challenge sent!')

      // refresh players and challengables
      const pRaw = await getPlayersForSport(selectedSport.id)
      const p = calculateRanks(pRaw)
      setPlayers(p)

      // Re-calculate challengables with shared logic
      const cooldownDays = selectedSport.scoring_config?.rematch_cooldown_days ?? 7
      const recentMatches = await getMatchesSince(myProfile.id, cooldownDays)

      const recentOpponentIds = new Set(
        recentMatches
          .map((m: any) => m.opponent?.id)
          .filter(Boolean) as string[]
      )

      const validOpponents = getChallengablePlayers(p, myProfile, selectedSport.scoring_config, recentOpponentIds)

      setChallengables(new Set(validOpponents.map(x => x.id)))

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to create challenge')
    } finally {
      setSubmittingChallenge(null)
    }
  }

  if (loading) return <div>Loading…</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <aside className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className='text-center text-2xl font-bold text-shadow-sm'>Sports</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {sports.map(s => (
                <li key={s.id}>
                  <Button
                    variant={selectedSport?.id === s.id ? 'default' : 'secondary'}
                    onClick={() => setSelectedSport(s)}
                    className="w-full justify-start font-bold"
                  >
                    {s.name}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </aside>

      <section className="md:col-span-3">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{selectedSport ? `${selectedSport.name} Ladder` : 'Select a sport'}</CardTitle>
            {!user && (
              <CardDescription>
                Viewing as guest. Sign in to join ladders and challenge players.
                <Button asChild size="sm" className="ml-2">
                  <Link href="/login">Sign in</Link>
                </Button>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>

            {selectedSport ? (
              <RankingsTable
                players={players}
                ranks={ranks}
                challengables={challengables}
                submittingChallenge={submittingChallenge}
                handleChallenge={handleChallenge}
                selectedSport={selectedSport}
                user={user}
                playerRefs={playerRefs}
                recentMap={recentMap}
              />
            ) : (
              <p className="text-muted-foreground">Choose a sport to view its ladder.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
