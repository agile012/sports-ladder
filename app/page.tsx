
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'
import LadderList from '@/components/ladders/LadderList'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PendingChallenges from '@/components/profile/PendingChallenges'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayerProfile, RankedPlayerProfile, PendingChallengeItem, Sport, MatchWithPlayers } from '@/lib/types'
import { motion } from 'framer-motion'
import { Trophy, ArrowRight, Activity, Calendar } from 'lucide-react'

export default function Home() {
  const { user, loading } = useUser()
  const { sports, getPlayersForSport, getUserProfileForSport, createChallenge, getPendingChallengesForUser, getRecentMatches, getAllPlayers, getUserProfiles } = useLadders()
  const [sportId, setSportId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [topLists, setTopLists] = useState<Record<string, PlayerProfile[]>>({})
  const [challengeLists, setChallengeLists] = useState<Record<string, RankedPlayerProfile[]>>({})
  const [loadingLists, setLoadingLists] = useState(false)
  const [pendingChallenges, setPendingChallenges] = useState<PendingChallengeItem[]>([])
  const [userProfileIds, setUserProfileIds] = useState<string[]>([])
  const [unjoinedSports, setUnjoinedSports] = useState<Sport[]>([])
  const [recentMatches, setRecentMatches] = useState<MatchWithPlayers[]>([])
  const router = useRouter()
  const userId = user?.id

  useEffect(() => {
    if (sports.length > 0 && !sportId) setSportId(sports[0].id)
  }, [sports, sportId])

  useEffect(() => {
    async function loadRecent() {
      try {
        const data = await getRecentMatches(5) as MatchWithPlayers[]
        setRecentMatches(data || [])
      } catch (e) {
        console.error('Failed to load recent matches', e)
        setRecentMatches([])
      }
    }
    loadRecent()

    async function loadLists() {
      setLoadingLists(true)
      const tops: Record<string, PlayerProfile[]> = {}
      const challengables: Record<string, RankedPlayerProfile[]> = {}

      const [allPlayers, myProfiles] = await Promise.all([
        getAllPlayers(),
        userId ? getUserProfiles(userId) : Promise.resolve([]),
      ])

      for (const s of sports) {
        const players = allPlayers.filter((p) => p.sport_id === s.id)
        tops[s.id] = players.slice(0, 5)

        if (userId) {
          const myProfile = myProfiles.find((p) => p.sport_id === s.id)
          if (myProfile) {
            const ranks: number[] = []
            let lastRank = 0
            for (let i = 0; i < players.length; i++) {
              if (i === 0) {
                ranks.push(1)
                lastRank = 1
              } else {
                const prev = players[i - 1]
                if (players[i].rating === prev.rating) {
                  ranks.push(lastRank)
                } else {
                  ranks.push(i + 1)
                  lastRank = i + 1
                }
              }
            }

            const myIndex = players.findIndex(p => p.user_id === userId || p.id === myProfile.id)
            const myRank = myIndex >= 0 ? ranks[myIndex] : null

            if (myRank) {
              let challengable: RankedPlayerProfile[] = []
              if (myRank <= 10) {
                challengable = players
                  .map((p, i) => ({ ...p, rank: ranks[i] }))
                  .filter(p => p.id !== myProfile.id && p.rank <= 10)
                  .slice(0, 10)
              } else {
                const minRank = Math.max(1, myRank - 10)
                challengable = players
                  .map((p, i) => ({ ...p, rank: ranks[i] }))
                  .filter(p => p.rank < myRank && p.rank >= minRank)
                  .slice(0, 10)
              }
              challengables[s.id] = challengable
            } else {
              challengables[s.id] = []
            }
          } else {
            challengables[s.id] = []
          }
        } else {
          challengables[s.id] = []
        }
      }

      setTopLists(tops)
      setChallengeLists(challengables)
      setLoadingLists(false)

      if (userId) {
        try {
          const { supabase } = await import('@/lib/supabase/client')
          const { data: profiles } = await supabase.from('player_profiles').select('id, sport_id').eq('user_id', userId)
          const profileIds = (profiles || []).map((p: { id: string }) => p.id)
          setUserProfileIds(profileIds)

          if (profileIds.length > 0) {
            const pending = await getPendingChallengesForUser(userId) as PendingChallengeItem[]
            setPendingChallenges(pending)
          }

          const joinedSportIds = (profiles || []).map((p: { sport_id: string }) => p.sport_id)
          setUnjoinedSports(sports.filter(s => !joinedSportIds.includes(s.id)))
        } catch (e) {
          console.error('Error loading user profiles or pending challenges:', e)
          setPendingChallenges([])
          setUserProfileIds([])
        }
      } else {
        setPendingChallenges([])
        setUserProfileIds([])
        setUnjoinedSports(sports)
      }
    }

    if (sports.length > 0) loadLists()
  }, [sports, userId, getPlayersForSport, getUserProfileForSport, getPendingChallengesForUser, getAllPlayers, getUserProfiles, getRecentMatches])

  async function join() {
    if (!user) {
      router.push('/login')
      return
    }
    if (!sportId) {
      setMessage('Please select a sport to join.')
      return
    }

    const sportName = sports.find(s => s.id === sportId)?.name ?? 'this sport'
    const confirmed = window.confirm(`Join ${sportName} ladder? Are you sure you want to join?`)
    if (!confirmed) return

    setSubmitting(true)
    setMessage(null)

    const { error } = await (await import('@/lib/supabase/client')).supabase.from('player_profiles').insert({ user_id: user.id, sport_id: sportId })
    setSubmitting(false)

    if (error) {
      if (error.code === '23505' || /duplicate|unique/.test(error.message || '')) {
        setMessage('You already joined this sport.')
      } else {
        setMessage(error.message)
      }
      return
    }

    setMessage('Joined! Redirecting to the ladder...')
    router.push(`/ladder?sport=${sportId}`)
  }

  async function handleChallenge(sportId: string, opponentProfileId: string) {
    if (!user) {
      router.push('/login')
      return
    }

    const myProfile = await getUserProfileForSport(user.id, sportId)
    if (!myProfile) {
      setMessage('Join this sport before challenging someone.')
      return
    }

    setSubmitting(true)
    try {
      await createChallenge(sportId, myProfile.id, opponentProfileId)
      setMessage('Challenge sent!')
      const players = await getPlayersForSport(sportId)
      setTopLists(prev => ({ ...prev, [sportId]: players.slice(0, 5) }))
      const ranks: number[] = []
      let lastRank = 0
      for (let i = 0; i < players.length; i++) {
        if (i === 0) {
          ranks.push(1)
          lastRank = 1
        } else {
          const prev = players[i - 1]
          if (players[i].rating === prev.rating) {
            ranks.push(lastRank)
          } else {
            ranks.push(i + 1)
            lastRank = i + 1
          }
        }
      }

      const myIndex = players.findIndex(p => p.user_id === user.id || p.id === myProfile.id)
      const myRank = myIndex >= 0 ? ranks[myIndex] : null
      if (myRank) {
        let challengable: RankedPlayerProfile[] = []
        if (myRank <= 10) {
          challengable = players
            .map((p, i) => ({ ...p, rank: ranks[i] }))
            .filter(p => p.id !== myProfile.id && p.rank <= 10)
            .slice(0, 10)
        } else {
          const minRank = Math.max(1, myRank - 10)
          challengable = players
            .map((p, i) => ({ ...p, rank: ranks[i] }))
            .filter(p => p.rank < myRank && p.rank >= minRank)
            .slice(0, 10)
        }
        setChallengeLists(prev => ({ ...prev, [sportId]: challengable }))
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Unable to create challenge')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-[50vh]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-t-2 border-primary rounded-full"
      />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">

      {/* Sidebar / Secondary Content */}
      <aside className="md:col-span-1 space-y-6 md:order-last">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className='overflow-hidden border-none shadow-xl bg-gradient-to-br from-card to-card/50 backdrop-blur-sm sticky top-24'>
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trophy className="h-5 w-5 text-primary" />
                Join a Ladder
              </CardTitle>
              <CardDescription>
                Select a sport to start competing
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {!user ? (
                <div className="text-center py-4">
                  <p className="mb-6 text-sm text-muted-foreground">Sign in to join the competition and track your ranking.</p>
                  <Button onClick={() => router.push('/login')} className='w-full font-bold shadow-lg shadow-primary/20'>
                    Sign in to Join
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Sport</label>
                    <Select onValueChange={setSportId} defaultValue={sportId ?? undefined}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Choose a sport" />
                      </SelectTrigger>
                      <SelectContent>
                        {unjoinedSports.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button onClick={join} disabled={submitting} className="w-full font-semibold shadow-lg shadow-primary/20">
                      {submitting ? 'Joining…' : 'Join Ladder'}
                    </Button>
                    <Button onClick={() => router.push('/ladder')} variant="outline" className="w-full bg-background/50">
                      View All
                    </Button>
                  </div>

                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-md bg-muted/50 text-sm border border-border/50 text-muted-foreground"
                    >
                      {message}
                    </motion.div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {pendingChallenges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <PendingChallenges challenges={pendingChallenges} currentUserIds={userProfileIds} />
          </motion.div>
        )}
      </aside>

      {/* Main Content */}
      <main className="md:col-span-2 space-y-8">

        {/* Recent Matches Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </h2>
            <Link href="/match-history" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors group">
              View full history <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid gap-3">
            {recentMatches.length === 0 && (
              <div className="p-8 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/20">
                No recent matches found
              </div>
            )}
            {recentMatches.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + (i * 0.05) }}
              >
                <Link
                  href={`/matches/${m.id}`}
                  className="block group p-4 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card hover:shadow-md transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                        <span className="hover:text-primary transition-colors">
                          {m.player1?.full_name ?? 'Player 1'}
                        </span>
                        <span className="text-muted-foreground text-sm font-normal">vs</span>
                        <span className="hover:text-primary transition-colors">
                          {m.player2?.full_name ?? 'Player 2'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                        <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground">
                          {sports.find(s => s.id === m.sport_id)?.name ?? 'Sport'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm self-start sm:self-center">
                      {m.winner_id ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
                          <Trophy className="h-3 w-3" />
                          <span className="font-semibold">
                            {(m.player1?.id === m.winner_id ? m.player1?.full_name : m.player2?.id === m.winner_id ? m.player2?.full_name : m.winner_id)} won
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic px-3 py-1">Pending result</span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Ladders Tabs */}
        {sports.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Tabs defaultValue={sports[0].id} className="w-full space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Top Rankings</h2>
                <TabsList className='bg-muted/50 p-1'>
                  {sports.map((s) => (
                    <TabsTrigger
                      key={s.id}
                      value={s.id}
                      className='font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm'
                    >
                      {s.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {sports.map(s => (
                <TabsContent key={s.id} value={s.id} className="mt-0">
                  <LadderList
                    sports={[s]}
                    topLists={topLists}
                    challengeLists={challengeLists}
                    loadingLists={loadingLists}
                    submitting={submitting}
                    handleChallenge={handleChallenge}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </motion.div>
        ) : (
          <div className="text-center p-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
            No sports available.
          </div>
        )}
      </main>
    </div>
  )
}
