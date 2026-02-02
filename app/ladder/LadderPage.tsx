'use client'
import { useEffect, useState, useMemo, createRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sport, RankedPlayerProfile } from '@/lib/types'
import { toast } from "sonner"
import { calculateRanks, getChallengablePlayers, getCooldownOpponents } from '@/lib/ladderUtils'
import { createBrowserClient } from '@supabase/ssr'
import LadderHeader from '@/components/ladder/LadderHeader'
import LadderView from '@/components/ladder/LadderView'
import { cn } from '@/lib/utils'

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
        const { data } = await supabase.from('sports').select('id, name, scoring_config, is_paused').order('name')
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
        // Fetch enough history (e.g. 60 days to be safe) or exact cooldownDays? 
        // getMatchesSince uses exact days. But getCooldownOpponents handles status checks.
        // Let's fetch strict range + buffer, or just rely on getMatchesSince logic.
        // Wait, getMatchesSince filters by date already!
        // But it includes CANCELLED. getCooldownOpponents filters them OUT.
        // So we pass the matches to getCooldownOpponents.
        const recentMatches = await getMatchesSince(myProfile.id, Math.max(cooldownDays, 60)) // Fetch wider range

        // Fix type mismatch: getMatchesSince returns MatchHistoryItem where player1_id is optional (?) 
        // actually MatchHistoryItem defined in types has optional ps.
        // We need to ensure we pass strings or nulls.
        const mappedMatches = recentMatches.map(m => ({
          player1_id: m.player1_id || null, // Ensure string | null
          player2_id: m.player2_id || null,
          status: m.status,
          created_at: m.created_at,
          updated_at: m.updated_at
        }))

        const recentOpponentIds = getCooldownOpponents(mappedMatches, myProfile.id, cooldownDays)

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

    if (selectedSport.is_paused) {
      toast.error('This ladder is currently paused. Challenges are disabled.')
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
    <div className="max-w-4xl mx-auto pb-safe-area-inset-bottom">

      {/* Mobile Sport Selector - Top Position */}
      <div className="md:hidden overflow-x-auto pb-2 -mx-4 px-4 flex gap-2 no-scrollbar mb-4 sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
        {sports.map(s => (
          <Button
            key={s.id}
            size="sm"
            variant={selectedSport?.id === s.id ? 'default' : 'outline'}
            className="rounded-full whitespace-nowrap shadow-sm"
            onClick={() => setSelectedSport(s)}
          >
            {s.name}
          </Button>
        ))}
      </div>

      {/* Mobile-first Header */}
      <LadderHeader
        selectedSport={selectedSport}
        user={user}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      <div className="md:grid md:grid-cols-4 md:gap-8">
        {/* Desktop Sidebar for Sports (Hidden on Mobile) */}
        <aside className="hidden md:block md:col-span-1 space-y-4">
          <Card className="sticky top-24 border-none shadow-none bg-transparent">
            <h3 className="font-semibold text-lg px-2 mb-2">Sports</h3>
            <nav className="space-y-1">
              {sports.map(s => (
                <Button
                  key={s.id}
                  variant={selectedSport?.id === s.id ? 'secondary' : 'ghost'}
                  className={cn("w-full justify-start", selectedSport?.id === s.id && "bg-primary/10 text-primary font-bold")}
                  onClick={() => setSelectedSport(s)}
                >
                  {s.name}
                </Button>
              ))}
            </nav>
          </Card>
        </aside>

        {/* Main Content */}
        <section className="md:col-span-3 min-h-[60vh]">
          {selectedSport ? (
            <LadderView
              players={sortedPlayers}
              user={user}
              challengables={challengables}
              submittingChallenge={submittingChallenge}
              handleChallenge={handleChallenge}
              selectedSport={selectedSport}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              <span className="mb-2 text-4xl">🏅</span>
              <p>Select a sport to start</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
