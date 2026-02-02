'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'
import Link from 'next/link'
import { Trophy, Sparkles, Activity, Target, ArrowRight, Zap, TrendingUp, History, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PendingChallenges from '@/components/profile/PendingChallenges'
import RecentMatchesList from '@/components/matches/RecentMatchesList'
import { PlayerProfile, RankedPlayerProfile, PendingChallengeItem, Sport, MatchWithPlayers, PlayerProfileExtended } from '@/lib/types'
import { motion } from 'framer-motion'
import { toast } from "sonner"
import { rejoinLadder } from '@/lib/actions/ladderActions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

import { useAppBadge } from '@/lib/hooks/useAppBadge'

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
    const [myProfiles, setMyProfiles] = useState<PlayerProfileExtended[]>([])
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null)

    const router = useRouter()
    const { createChallenge, getUserProfileForSport } = useLadders()

    // Sync App Badge
    useAppBadge(pendingChallenges.length)

    // Fetch Data
    useEffect(() => {
        let cancelled = false
        const fetchData = async () => {
            if (userLoading) return
            try {
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

                    const activeS: Sport[] = []
                    const inactiveS: Sport[] = []
                    data.sports.forEach(s => {
                        const profile = data.myProfiles.find(p => p.sport_id === s.id)
                        if (profile && profile.deactivated) inactiveS.push(s)
                        else activeS.push(s)
                    })
                    setActiveSports(activeS)
                    setInactiveSports(inactiveS)

                    if (!sportId && activeS.length > 0) setSportId(activeS[0].id)
                    else if (!sportId && activeS.length === 0) setSportId(null)

                    setLoadingData(false)
                }
            } catch (e) {
                console.error("Dashboard Fetch Error", e)
                if (!cancelled) setLoadingData(false)
            }
        }
        fetchData()
        return () => { cancelled = true }
    }, [user, userLoading])

    const loading = userLoading || loadingData

    // Actions
    async function join() {
        if (!user) { router.push('/login'); return }

        if (verificationStatus !== 'verified') {
            toast.error('Your profile needs to be verified by an admin before you can join a ladder.')
            return
        }

        if (!sportId) { toast.error('Please select a sport.'); return }
        setSubmitting(true)
        const { error } = await (await import('@/lib/supabase/client')).supabase.from('player_profiles').insert({ user_id: user.id, sport_id: sportId })
        if (error) {
            setSubmitting(false)
            if (error.code === '23505' || /duplicate|unique/.test(error.message || '')) toast.info('Already joined.')
            else toast.error(error.message)
            return
        }
        await refreshData()
    }

    async function handleRejoinLadder(sId: string) {
        setSubmitting(true)
        try {
            await rejoinLadder(sId, user!.id)
            toast.success(`Welcome back!`)
            await refreshData()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    async function refreshData() {
        try {
            // Re-fetch logic (simplified for brevity)
            window.location.reload() // Easiest for full refresh for now, or copy fetchData logic
        } catch (e) {
            console.error(e)
        }
    }

    if (loading) return (
        <div className="flex justify-center items-center h-[50vh]">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-8 h-8 border-t-2 border-primary rounded-full" />
        </div>
    )

    // Current Sport Data
    const currentProfile = myProfiles.find(p => p.sport_id === sportId)
    const currentSport = activeSports.find(s => s.id === sportId)
    const sportMatches = recentMatches.filter(m => m.sport_id === sportId)
    const sportTopList = sportId ? topLists[sportId] : []

    return (
        <div className="pb-24 space-y-6 animate-slide-up max-w-4xl mx-auto px-4 md:px-8">

            {/* 1. Hero / Welcome */}
            {!user ? (
                <div className="relative overflow-hidden rounded-3xl bg-primary/5 border border-primary/10 p-8 text-center md:text-left md:flex items-center gap-8 shadow-sm">
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
                    <div className="relative z-10 space-y-4 flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 backdrop-blur border text-xs font-semibold text-primary mb-2">
                            <Sparkles className="h-3 w-3" /> Welcome to the Arena
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                            Rise to the <span className="text-primary">Top</span>
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-lg mx-auto md:mx-0">
                            Join the IIMA Sports Ladder. Challenge opponents, track your Elo, and claim your victory.
                        </p>
                        <div className="flex gap-4 justify-center md:justify-start pt-2">
                            <Button size="lg" className="rounded-full font-bold shadow-xl shadow-primary/20" onClick={() => router.push('/login')}>
                                Get Started
                            </Button>
                            <Button size="lg" variant="outline" className="rounded-full bg-transparent" onClick={() => router.push('/ladder')}>
                                View Ladders
                            </Button>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <Trophy className="h-40 w-40 text-primary/20 rotate-12" />
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Hello, {user.user_metadata?.full_name?.split(' ')[0] || 'Athlete'}! 👋</h1>
                        <p className="text-muted-foreground text-sm">Ready to compete today?</p>
                    </div>
                    {/* Add notification bell or profile quick link here if needed */}
                </div>
            )}

            {/* 2. Horizontal Sport Selector (Pills) */}
            {user && (
                <div className="space-y-4">
                    {/* Sport Selector - Premium Scrollable Tabs */}
                    {activeSports.length > 0 ? (
                        <div className="relative -mx-4 md:mx-0 mb-6">
                            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />

                            <div className="overflow-x-auto flex gap-3 px-6 md:px-0 pb-4 no-scrollbar items-center snap-x snap-mandatory scroll-pl-6 md:flex-wrap">
                                {activeSports.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSportId(s.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 snap-start border select-none",
                                            sportId === s.id
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-100 border-primary"
                                                : "bg-card/50 backdrop-blur-sm text-muted-foreground border-border/50 hover:bg-card hover:text-foreground hover:border-border hover:scale-105"
                                        )}
                                    >
                                        {/* Simple icon logic */}
                                        {s.name === 'Badminton' ? '🏸' : s.name === 'Table Tennis' ? '🏓' : s.name === 'Squash' ? '🎾' : '🏅'}
                                        {s.name}
                                    </button>
                                ))}

                                {inactiveSports.length > 0 && (
                                    <div className="px-3 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground whitespace-nowrap snap-start border border-transparent">
                                        + {inactiveSports.length} Archived
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar snap-x md:mx-0 md:px-0">
                            <div className="min-w-[280px] snap-center">
                                <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="bg-background/50 p-3 rounded-full"><Trophy className="h-6 w-6 text-primary" /></div>
                                        <div>
                                            <h3 className="font-bold">Join a Sport</h3>
                                            <p className="text-xs text-muted-foreground">Start your journey</p>
                                        </div>
                                        <Button size="sm" className="ml-auto rounded-full" onClick={() => (document.getElementById('join-section') as HTMLElement)?.scrollIntoView({ behavior: 'smooth' })}>Go</Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Pending Challenges - Priority Display */}
                    {pendingChallenges.length > 0 && (
                        <div className="animate-slide-in-right">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                <h3 className="font-bold text-sm uppercase tracking-wide text-amber-600 dark:text-amber-400">Action Required</h3>
                            </div>
                            <PendingChallenges challenges={pendingChallenges} currentUserIds={userProfileIds} />
                        </div>
                    )}

                    {/* 3. Sport Dashboard Content */}
                    {sportId && currentSport && (
                        <motion.div
                            key={sportId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            {/* Actions (Moved Top for Desktop) */}
                            <div className="hidden md:grid grid-cols-2 gap-4">
                                <Button className="w-full font-bold shadow-lg shadow-primary/10" onClick={() => router.push('/ladder')}>
                                    <Swords className="mr-2 h-4 w-4" /> Challenge Someone
                                </Button>
                                <Button variant="outline" className="w-full bg-card/50" onClick={() => router.push('/match-history')}>
                                    <History className="mr-2 h-4 w-4" /> View History
                                </Button>
                            </div>

                            {/* Stats Overview Grid */}
                            {currentProfile && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm hover:border-primary/50 transition-colors group">
                                        <CardContent className="p-5 text-center space-y-1">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider group-hover:text-primary transition-colors">Rank</div>
                                            <div className="text-3xl font-black text-foreground tracking-tight">#{currentProfile.ladder_rank || '-'}</div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm hover:border-primary/50 transition-colors group">
                                        <CardContent className="p-5 text-center space-y-1">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider group-hover:text-primary transition-colors">Rating</div>
                                            <div className="text-3xl font-black text-primary tracking-tight">{currentProfile.rating}</div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm col-span-2 flex items-center justify-around px-6 hover:border-primary/50 transition-colors">
                                        <div className="text-center">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Matches</div>
                                            <div className="text-2xl font-bold">{currentProfile.matches_played}</div>
                                        </div>
                                        <div className="h-10 w-[1px] bg-border"></div>
                                        <div className="text-center">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Win Rate</div>
                                            <div className="text-2xl font-bold text-emerald-500">
                                                {currentProfile.stats?.winRate ?? 0}%
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* Main Content Grid: Matches & Rankings */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Recent Activity */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="font-bold text-xl flex items-center gap-2">
                                            <History className="h-5 w-5 text-primary" /> Recent Matches
                                        </h3>
                                        <Link href="/match-history" className="text-sm text-muted-foreground hover:text-primary font-medium hover:underline transition-colors">View All</Link>
                                    </div>
                                    <RecentMatchesList matches={sportMatches.slice(0, 3)} sport={currentSport} />
                                </section>

                                {/* Top Rankings Preview */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="font-bold text-xl flex items-center gap-2">
                                            <TrendingUp className="h-5 w-5 text-primary" /> Top Ranked
                                        </h3>
                                        <Link href="/ladder" className="text-sm text-muted-foreground hover:text-primary font-medium hover:underline transition-colors">Full Ladder</Link>
                                    </div>
                                    <div className="space-y-3">
                                        {sportTopList.slice(0, 3).map((player, i) => (
                                            <Link
                                                href={`/player/${player.id}`}
                                                key={player.id}
                                                className="flex items-center gap-4 p-4 rounded-2xl bg-card/40 hover:bg-card hover:shadow-md hover:-translate-y-0.5 transition-all border border-border/40 group"
                                            >
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-sm",
                                                    i === 0 ? "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800" :
                                                        i === 1 ? "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800" :
                                                            "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800"
                                                )}>
                                                    #{i + 1}
                                                </div>
                                                <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                                                    <AvatarImage src={player.avatar_url || ''} />
                                                    <AvatarFallback className="font-bold">{player.full_name?.substring(0, 1)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-base truncate group-hover:text-primary transition-colors">{player.full_name}</div>
                                                    <div className="text-xs font-medium text-muted-foreground">{player.rating} Elo</div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            {/* Mobile Actions (Bottom) */}
                            <div className="grid grid-cols-2 gap-3 pt-2 md:hidden">
                                <Button className="w-full font-bold shadow-lg shadow-primary/20" onClick={() => router.push('/ladder')}>
                                    <Swords className="mr-2 h-4 w-4" /> Challenge
                                </Button>
                                <Button variant="outline" className="w-full" onClick={() => router.push('/match-history')}>
                                    <History className="mr-2 h-4 w-4" /> History
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </div>
            )
            }

            {/* Join Section (Sidebar logic moved to bottom/block for mobile) */}
            <div id="join-section" className="space-y-4 pt-8">
                <h3 className="font-bold text-lg px-1">Explore Sports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unjoinedSports.map(s => (
                        <Card key={s.id} className="overflow-hidden border-none shadow-sm bg-gradient-to-br from-card to-muted/50">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-background p-2 rounded-xl shadow-sm">
                                        {s.name === 'Badminton' ? '🏸' : '🏅'}
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{s.name}</h4>
                                        <p className="text-xs text-muted-foreground">Join the ladder</p>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => { setSportId(s.id); join(); }}>Join</Button>
                            </CardContent>
                        </Card>
                    ))}
                    {inactiveSports.map(s => (
                        <Card key={s.id} className="overflow-hidden border-none shadow-sm bg-muted/20 opacity-80">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-background/50 p-2 rounded-xl">
                                        <History className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{s.name}</h4>
                                        <p className="text-xs text-muted-foreground">Rejoin this ladder</p>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => handleRejoinLadder(s.id)}>Rejoin</Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

        </div >
    )
}

function Swords({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" /></svg>
}
