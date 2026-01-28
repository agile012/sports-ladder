'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'
import LadderList from '@/components/ladders/LadderList'
import { Trophy, History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PendingChallenges from '@/components/profile/PendingChallenges'
import RecentMatchesList from '@/components/matches/RecentMatchesList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayerProfile, RankedPlayerProfile, PendingChallengeItem, Sport, MatchWithPlayers } from '@/lib/types'
import { motion } from 'framer-motion'
import { toast } from "sonner"
import { rejoinLadder } from '@/lib/actions/ladderActions'

export default function DashboardClient() {
    const { user, loading: userLoading } = useUser()

    // State
    const [loadingData, setLoadingData] = useState(true)
    const [sportId, setSportId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [activeSports, setActiveSports] = useState<Sport[]>([])
    const [inactiveSports, setInactiveSports] = useState<Sport[]>([])
    const [topLists, setTopLists] = useState<Record<string, PlayerProfile[]>>({})
    const [challengeLists, setChallengeLists] = useState<Record<string, RankedPlayerProfile[]>>({})
    const [pendingChallenges, setPendingChallenges] = useState<PendingChallengeItem[]>([])
    const [userProfileIds, setUserProfileIds] = useState<string[]>([])
    const [unjoinedSports, setUnjoinedSports] = useState<Sport[]>([])
    const [recentMatches, setRecentMatches] = useState<MatchWithPlayers[]>([])
    const [myProfiles, setMyProfiles] = useState<PlayerProfile[]>([])
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null)

    const router = useRouter()

    const { createChallenge, getUserProfileForSport } = useLadders()

    // Fetch Data on Load or User Change
    useEffect(() => {
        let cancelled = false
        const fetchData = async () => {
            // Wait for user to be determined (null or object)
            if (userLoading) return

            try {
                // Dynamically import server action to invoke it from client
                const { getDashboardData } = await import('@/lib/actions/dashboard')
                const data = await getDashboardData(user?.id)

                if (!cancelled) {
                    setTopLists(data.topLists)
                    setChallengeLists(data.challengeLists)
                    setPendingChallenges(data.pendingChallenges)
                    setUserProfileIds(data.userProfileIds)
                    setUnjoinedSports(data.unjoinedSports)
                    setRecentMatches(data.recentMatches)
                    setMyProfiles(data.myProfiles)
                    setVerificationStatus(data.verificationStatus)

                    // Distinguish Active vs Inactive
                    const activeS: Sport[] = []
                    const inactiveS: Sport[] = []

                    data.sports.forEach(s => {
                        const profile = data.myProfiles.find(p => p.sport_id === s.id)
                        if (profile && profile.deactivated) {
                            inactiveS.push(s)
                        } else {
                            activeS.push(s)
                        }
                    })

                    setActiveSports(activeS)
                    setInactiveSports(inactiveS)

                    // Set default sport if not set
                    if (!sportId && activeS.length > 0) {
                        setSportId(activeS[0].id)
                    } else if (!sportId && activeS.length === 0) {
                        setSportId(null)
                    }

                    setLoadingData(false)
                }
            } catch (e) {
                console.error("Dashboard Fetch Error", e)
                toast.error("Failed to load dashboard")
                if (!cancelled) setLoadingData(false)
            }
        }

        fetchData()

        return () => { cancelled = true }
    }, [user, userLoading]) // Intentionally omit sportId to avoid reset loop

    const loading = userLoading || loadingData

    async function join() {
        if (!user) {
            router.push('/login')
            return
        }
        if (!sportId) {
            toast.error('Please select a sport to join.')
            return
        }

        setSubmitting(true)

        const { error } = await (await import('@/lib/supabase/client')).supabase.from('player_profiles').insert({ user_id: user.id, sport_id: sportId })

        if (error) {
            setSubmitting(false)
            if (error.code === '23505' || /duplicate|unique/.test(error.message || '')) {
                toast.info('You already joined this sport.')
            } else {
                toast.error(error.message)
            }
            return
        }

        await refreshData()
    }

    async function handleChallenge(sportId: string, opponentProfileId: string) {
        if (!user) {
            router.push('/login')
            return
        }

        const myProfile = await getUserProfileForSport(user.id, sportId)
        if (!myProfile) {
            toast.error('Join this sport before challenging someone.')
            return
        }

        setSubmitting(true)
        try {
            await createChallenge(sportId, myProfile.id, opponentProfileId)
            toast.success('Challenge sent!')
            await refreshData()

        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Unable to create challenge')
        } finally {
            setSubmitting(false)
        }
    }

    // handleLeaveLadder removed

    async function handleRejoinLadder(sId: string) {
        setSubmitting(true)
        try {
            const { newRank } = await rejoinLadder(sId, user!.id)
            toast.success(`Welcome back! You have been assigned rank ${newRank}.`)
            await refreshData()
        } catch (e: any) {
            toast.error(e.message || 'Failed to rejoin ladder')
        } finally {
            setSubmitting(false)
        }
    }

    async function refreshData() {
        try {
            const { getDashboardData } = await import('@/lib/actions/dashboard')
            const data = await getDashboardData(user!.id)

            setTopLists(data.topLists)
            setChallengeLists(data.challengeLists)
            setPendingChallenges(data.pendingChallenges)
            setUserProfileIds(data.userProfileIds)
            setUnjoinedSports(data.unjoinedSports)
            setMyProfiles(data.myProfiles)
            setRecentMatches(data.recentMatches)

            const activeS: Sport[] = []
            const inactiveS: Sport[] = []

            data.sports.forEach(s => {
                const profile = data.myProfiles.find(p => p.sport_id === s.id)
                if (profile && profile.deactivated) {
                    inactiveS.push(s)
                } else {
                    activeS.push(s)
                }
            })

            setActiveSports(activeS)
            setInactiveSports(inactiveS)
            if (activeS.length > 0 && (!sportId || !activeS.find(s => s.id === sportId))) {
                setSportId(activeS[0].id)
            }
        } catch (e) {
            console.error(e)
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

                                    <div className="pt-2 space-y-3">
                                        {(verificationStatus === 'pending' || verificationStatus === 'rejected') ? (
                                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-md text-sm">
                                                <p className="font-bold flex items-center gap-2">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                    </span>
                                                    Account Pending Approval
                                                </p>
                                                <p className="mt-1 text-xs opacity-90">
                                                    An admin must verify your account before you can join ladders. {user.email?.endsWith('iima.ac.in') ? 'IIMA emails should be auto-verified.' : ''}
                                                </p>
                                            </div>
                                        ) : (
                                            <Button onClick={join} disabled={submitting} className="w-full font-semibold shadow-lg shadow-primary/20">
                                                {submitting ? 'Joining…' : 'Join Ladder'}
                                            </Button>
                                        )}

                                        <Button onClick={() => router.push('/ladder')} variant="outline" className="w-full bg-background/50">
                                            View All
                                        </Button>
                                    </div>

                                    {/* Inactive Ladders Section */}
                                    {inactiveSports.length > 0 && (
                                        <div className="pt-4 border-t mt-4">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                                <History className="h-3 w-3" /> Rejoin Ladder
                                            </h4>
                                            <ul className="space-y-2">
                                                {inactiveSports.map(s => (
                                                    <li key={s.id} className="flex items-center justify-between text-sm p-2 bg-muted/40 rounded-md">
                                                        <span className="font-medium">{s.name}</span>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleRejoinLadder(s.id)}
                                                            disabled={submitting}
                                                        >
                                                            Rejoin
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
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

                {/* Sport Dashboard Tabs */}
                {activeSports.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Tabs defaultValue={activeSports[0].id} className="w-full space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Sport Dashboard</h2>
                                <TabsList className='bg-muted/50 p-1 flex-wrap h-auto'>
                                    {activeSports.map((s) => (
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

                            {activeSports.map(s => (
                                <TabsContent key={s.id} value={s.id} className="mt-0 space-y-8">
                                    {/* Leave Ladder Button REMOVED */}

                                    <RecentMatchesList
                                        matches={recentMatches.filter(m => m.sport_id === s.id).slice(0, 5)}
                                        sport={s}
                                    />

                                    <div>
                                        <h3 className="text-lg font-bold mb-4">Rankings</h3>
                                        <LadderList
                                            sports={[s]}
                                            topLists={topLists}
                                            challengeLists={challengeLists}
                                            loadingLists={false}
                                            submitting={submitting}
                                            handleChallenge={handleChallenge}
                                        />
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </motion.div>
                ) : (
                    <div className="text-center p-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                        {inactiveSports.length > 0 ? 'You have inactive ladders. Rejoin to compete!' : 'No active sports. Join a ladder to get started!'}
                    </div>
                )}
            </main>
        </div>
    )
}
