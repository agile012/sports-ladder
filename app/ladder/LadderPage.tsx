'use client'
import { useEffect, useState, useMemo, createRef } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { useRouter } from 'nextjs-toploader/app';
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sport, RankedPlayerProfile } from '@/lib/types'
import { toast } from "sonner"
import { calculateRanks, getChallengablePlayers, getCooldownOpponents } from '@/lib/ladderUtils'
import { supabase } from '@/lib/supabase/client'
import { rejoinLadder } from '@/lib/actions/ladderActions'
import LadderHeader from '@/components/ladder/LadderHeader'
import LadderView from '@/components/ladder/LadderView'
import { cn } from '@/lib/utils'

interface LadderPageProps {
  initialSports?: Sport[]
  initialPlayers?: RankedPlayerProfile[]
  initialSelectedSportId?: string
  initialRecentMap?: Record<string, any[]>
}

export default function LadderPage({ initialSports, initialPlayers, initialSelectedSportId, initialRecentMap }: LadderPageProps) {
  const { user } = useUser()
  const { getUserProfileForSport, createChallenge, getMatchesSince, getPlayersForSport } = useLadders()

  const [sports, setSports] = useState<Sport[]>(initialSports || [])
  const [selectedSport, setSelectedSport] = useState<Sport | null>(
    initialSports?.find(s => s.id === initialSelectedSportId) || initialSports?.[0] || null
  )
  const [players, setPlayers] = useState<RankedPlayerProfile[]>(initialPlayers || [])
  const [loading, setLoading] = useState(!initialSports)
  const [sortBy, setSortBy] = useState<'ladder' | 'rating'>('ladder')

  const [recentMap, setRecentMap] = useState<Record<string, any[]>>(initialRecentMap || {})
  const [challengables, setChallengables] = useState<Set<string>>(new Set())
  const [submittingChallenge, setSubmittingChallenge] = useState<string | null>(null)
  const [isDeactivated, setIsDeactivated] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Sync props when they change (server navigation)
  useEffect(() => {
    if (initialSports) setSports(initialSports)
  }, [initialSports])

  useEffect(() => {
    if (initialSelectedSportId && initialSports) {
      const found = initialSports.find(s => s.id === initialSelectedSportId)
      if (found) setSelectedSport(found)
    }
  }, [initialSelectedSportId, initialSports])

  useEffect(() => {
    if (initialPlayers) setPlayers(initialPlayers)
  }, [initialPlayers])

  useEffect(() => {
    if (initialRecentMap) setRecentMap(initialRecentMap)
  }, [initialRecentMap])

  // Check if user has a deactivated profile for this sport
  useEffect(() => {
    if (!user || !selectedSport) {
      setIsDeactivated(false)
      return
    }
    // If user is already in the active players list, they're not deactivated
    if (players.find(p => p.user_id === user.id)) {
      setIsDeactivated(false)
      return
    }
    // Check if there's a deactivated profile
    const checkDeactivated = async () => {
      const { data } = await supabase
        .from('player_profiles')
        .select('id, deactivated')
        .eq('user_id', user.id)
        .eq('sport_id', selectedSport.id)
        .single()
      setIsDeactivated(!!data?.deactivated)
    }
    checkDeactivated()
  }, [user, selectedSport, players])


  const handleSportSelect = (sport: Sport) => {
    // Navigate only. Let server prop update drive state to prevent data mismatch.
    const params = new URLSearchParams(searchParams.toString())
    params.set('sport', sport.id)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Initial Data Load (Sports) - only if no initial props
  useEffect(() => {
    if (initialSports && initialSports.length > 0) return

    const loadSports = async () => {
      try {
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
  }, [initialSports, searchParams])

  // Effect: Challengable Status (Client Side Only)
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
        const recentMatches = await getMatchesSince(myProfile.id, Math.max(cooldownDays, 60))

        const mappedMatches = recentMatches.map(m => ({
          player1_id: m.player1_id || null,
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

  // Refs needed for scrolling
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

      // Refresh to update UI
      router.refresh()

      // We can also optimistically update challengables if we knew logic here, 
      // but router.refresh should trigger re-fetch of recent matches on server 
      // which will propagate down. 
      // Actually challenging doesn't update 'recent matches' list immediately usually 
      // until it's accepted/played? 
      // Wait, pending challenges are NOT recent matches. 
      // Challengable status depends on PENDING challenges too? 
      // getChallengablePlayers logic checks if already challenged.
      // So we need to re-run "Effect Challengable Status"
      // Re-fetching user profile or matches might be needed. 
      // router.refresh() re-runs server component -> passes new props -> updates state -> triggers effect.

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to create challenge')
    } finally {
      setSubmittingChallenge(null)
    }
  }

  async function joinLadder() {
    if (!selectedSport || !user) return
    setLoading(true)
    try {
      const { error } = await supabase.from('player_profiles').insert({
        user_id: user.id,
        sport_id: selectedSport.id,
        rating: 1000,
        matches_played: 0
      })

      if (error) throw error

      toast.success(`You have joined the ${selectedSport.name} ladder!`)
      router.refresh()

    } catch (e: any) {
      toast.error(e.message || 'Failed to join ladder')
    } finally {
      setLoading(false)
    }
  }

  async function handleRejoin() {
    if (!selectedSport || !user) return
    setLoading(true)
    try {
      await rejoinLadder(selectedSport.id, user.id)
      toast.success(`Welcome back to the ${selectedSport.name} ladder!`)
      setIsDeactivated(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Failed to rejoin ladder')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto pb-safe-area-inset-bottom">

      {/* Mobile Sport Selector */}
      <div className="md:hidden overflow-x-auto pb-2 -mx-4 px-4 flex gap-2 no-scrollbar mb-4 sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
        {sports.map(s => (
          <Button
            key={s.id}
            size="default"
            variant={selectedSport?.id === s.id ? 'default' : 'outline'}
            className="rounded-full whitespace-nowrap shadow-sm h-11 px-6"
            onClick={() => handleSportSelect(s)}
          >
            {s.name}
          </Button>
        ))}
      </div>

      <LadderHeader
        selectedSport={selectedSport}
        user={user}
        sortBy={sortBy}
        setSortBy={setSortBy}
      >
        {user && selectedSport && !players.find(p => p.user_id === user.id) && (
          isDeactivated ? (
            <Button onClick={handleRejoin} disabled={loading}>
              Rejoin Ladder
            </Button>
          ) : (
            <Button onClick={joinLadder} disabled={loading}>
              Join Ladder
            </Button>
          )
        )}
      </LadderHeader>

      <div className="md:grid md:grid-cols-4 md:gap-8">
        <aside className="hidden md:block md:col-span-1 space-y-4">
          <Card className="sticky top-24 border-none shadow-none bg-transparent">
            <h3 className="font-semibold text-lg px-2 mb-2">Sports</h3>
            <nav className="space-y-1">
              {sports.map(s => (
                <Button
                  key={s.id}
                  variant={selectedSport?.id === s.id ? 'secondary' : 'ghost'}
                  className={cn("w-full justify-start h-11", selectedSport?.id === s.id && "bg-primary/10 text-primary font-bold")}
                  onClick={() => handleSportSelect(s)}
                >
                  {s.name}
                </Button>
              ))}
            </nav>
          </Card>
        </aside>

        <section className="md:col-span-3 min-h-[60vh]">
          {selectedSport ? (
            <LadderView
              players={sortedPlayers}
              user={user}
              challengables={challengables}
              submittingChallenge={submittingChallenge}
              handleChallenge={handleChallenge}
              selectedSport={selectedSport}
              recentMap={recentMap}
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
