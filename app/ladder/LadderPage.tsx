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
import { createBrowserClient } from '@supabase/ssr'

export default function LadderPage() {
  const { user } = useUser()
  const { getPlayersForSport, getUserProfileForSport, createChallenge, getMatchesSince, getRecentMatchesForSport } = useLadders()

  const [sports, setSports] = useState<Sport[]>([])
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null)
  const [players, setPlayers] = useState<RankedPlayerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'ladder' | 'rating'>('ladder')

  const [recentMap, setRecentMap] = useState<Record<string, any[]>>({})
  const [challengables, setChallengables] = useState<Set<string>>(new Set())
  const [submittingChallenge, setSubmittingChallenge] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()

  // Initial Data Load (Sports)
  useEffect(() => {
    const loadSports = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data } = await supabase.from('sports').select('id, name, scoring_config').order('name')
        if (data) {
          setSports(data as Sport[])

          const paramSport = searchParams.get('sport')
          if (paramSport) {
            const found = data.find(s => s.id === paramSport)
            if (found) setSelectedSport(found as Sport)
            else if (data.length > 0) setSelectedSport(data[0] as Sport)
          } else if (data.length > 0) {
            setSelectedSport(data[0] as Sport)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadSports()
  }, [])

  // Effect: Fetch players when selected sport changes
  useEffect(() => {
    if (!selectedSport) return

    setPlayers([])

    let cancelled = false
    const loadPlayers = async () => {
      try {
        const pRaw = await getPlayersForSport(selectedSport.id)
        if (!cancelled) {
          const p = calculateRanks(pRaw)
          setPlayers(p)
        }
      } catch (err) {
        console.error("Failed to load ladder", err)
        toast.error("Failed to load ladder data")
      }
    }
    loadPlayers()

    return () => { cancelled = true }
  }, [selectedSport, getPlayersForSport])

  // Effect A: Recent Matches
  useEffect(() => {
    if (!selectedSport) return
    let cancelled = false

    const fetchMatches = async () => {
      try {
        const matchesRaw = await getRecentMatchesForSport(selectedSport.id, 150)

        if (!cancelled) {
          const map: Record<string, any[]> = {}
          const finalStatuses = ['CONFIRMED', 'PROCESSED']

          matchesRaw.forEach(m => {
            const p1 = m.player1_id
            const p2 = m.player2_id

            if (p1) {
              if (!map[p1]) map[p1] = []
              if (map[p1].length < 3) {
                const result = finalStatuses.includes(m.status) ? (m.winner_id === p1 ? 'win' : 'loss') : null
                map[p1].push({ id: m.id, result, status: m.status })
              }
            }
            if (p2) {
              if (!map[p2]) map[p2] = []
              if (map[p2].length < 3) {
                const result = finalStatuses.includes(m.status) ? (m.winner_id === p2 ? 'win' : 'loss') : null
                map[p2].push({ id: m.id, result, status: m.status })
              }
            }
          })
          setRecentMap(map)
        }
      } catch (e) {
        console.error(e)
      }
    }

    fetchMatches()
    return () => { cancelled = true }
  }, [selectedSport, getRecentMatchesForSport])

  // Effect B: Challengable Status
  useEffect(() => {
    if (!selectedSport || players.length === 0 || !user) {
      setChallengables(new Set())
      return
    }
    let cancelled = false

    const fetchStatus = async () => {
      try {
        let myProfile: RankedPlayerProfile | null | undefined = players.find(p => p.user_id === user.id)

        if (!myProfile) {
          myProfile = await getUserProfileForSport(user.id, selectedSport.id) as RankedPlayerProfile
        }

        if (!myProfile) {
          if (!cancelled) setChallengables(new Set())
          return
        }

        const cooldownDays = selectedSport.scoring_config?.rematch_cooldown_days ?? 7
        const recentMatches = await getMatchesSince(myProfile.id, cooldownDays)
        const recentOpponentIds = new Set(
          recentMatches.map((m: any) => m.opponent?.id).filter(Boolean) as string[]
        )

        const validOpponents = getChallengablePlayers(players, myProfile, selectedSport.scoring_config, recentOpponentIds)
        if (!cancelled) {
          setChallengables(new Set(validOpponents.map(x => x.id)))
        }
      } catch (e) {
        console.error(e)
      }
    }

    fetchStatus()
    return () => { cancelled = true }
  }, [user, selectedSport, players, getUserProfileForSport, getMatchesSince])

  // Sort players
  const sortedPlayers = useMemo(() => {
    if (sortBy === 'ladder') return players;
    return [...players].sort((a, b) => b.rating - a.rating)
  }, [players, sortBy])

  const ranks = useMemo(() => sortedPlayers.map(p => p.rank), [sortedPlayers])

  // Refs need to match sorted list length
  const playerRefs = useMemo(() => Array(sortedPlayers.length).fill(0).map(() => createRef<HTMLTableRowElement>()), [sortedPlayers])

  // Scroll to profile
  useEffect(() => {
    const profileId = searchParams.get('profile')
    if (profileId && sortedPlayers.length > 0) {
      const playerIndex = sortedPlayers.findIndex(p => p.id === profileId)
      if (playerIndex !== -1 && playerRefs[playerIndex]?.current) {
        playerRefs[playerIndex].current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [sortedPlayers, searchParams, playerRefs])

  async function handleChallenge(opponentProfileId: string) {
    if (!selectedSport || !user) {
      router.push('/login')
      return
    }

    if (!challengables.has(opponentProfileId)) {
      toast.error('You cannot challenge this player.')
      return
    }

    const myProfile = await getUserProfileForSport(user.id, selectedSport.id)
    if (!myProfile) return

    setSubmittingChallenge(opponentProfileId)

    try {
      await createChallenge(selectedSport.id, myProfile.id, opponentProfileId)
      toast.success('Challenge sent!')

      const pRaw = await getPlayersForSport(selectedSport.id)
      const p = calculateRanks(pRaw)
      setPlayers(p)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to create challenge')
    } finally {
      setSubmittingChallenge(null)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

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

            {selectedSport && (
              <div className="flex justify-end mt-2">
                <div className="flex items-center space-x-2 bg-muted p-1 rounded-md">
                  <span className="text-xs font-medium px-2 text-muted-foreground">Sort By:</span>
                  <Button
                    variant={sortBy === 'ladder' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSortBy('ladder')}
                  >
                    Ladder
                  </Button>
                  <Button
                    variant={sortBy === 'rating' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSortBy('rating')}
                  >
                    Elo
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {selectedSport ? (
              <RankingsTable
                players={sortedPlayers}
                ranks={ranks}
                challengables={challengables}
                submittingChallenge={submittingChallenge}
                handleChallenge={handleChallenge}
                selectedSport={selectedSport}
                user={user!}
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
