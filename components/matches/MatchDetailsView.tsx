'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Trophy, Medal, ArrowLeft, Swords, Clock, Hash, TrendingUp, ArrowRight } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn, formatMatchDate } from '@/lib/utils'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScoreInput, ScoreSet } from '@/components/matches/ScoreInput'
import { toast } from "sonner"
import { useState, useEffect } from 'react'

import { RatingHistoryEntry, RankHistoryItem } from '@/lib/types'

type Player = {
    id: string
    full_name?: string
    avatar_url?: string
}

type MatchDetailsProps = {
    match: any
    player1: Player
    player2: Player
    sportName?: string | null
    currentUser?: any
    allowedToSubmit: boolean
    history?: RatingHistoryEntry[]
    rankHistory?: any[] // Using any[] to bypass strict check for now, or update types
    initialToken?: string
    initialAction?: string
    initialWinnerId?: string
    initialReporterId?: string
}

export default function MatchDetailsView({
    match,
    player1,
    player2,
    sportName,
    currentUser,
    allowedToSubmit,
    history = [],
    rankHistory = [],
    initialToken,
    initialAction,
    initialWinnerId,
    initialReporterId
}: MatchDetailsProps) {
    const winnerId = match.winner_id
    const [isReportOpen, setIsReportOpen] = useState(false)
    const [scores, setScores] = useState<ScoreSet[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isVerifyOpen, setIsVerifyOpen] = useState(false)
    const [isAcceptOpen, setIsAcceptOpen] = useState(false)
    const [alertConfig, setAlertConfig] = useState<{
        open: boolean
        title: string
        description: string
        action: () => Promise<void>
    }>({ open: false, title: '', description: '', action: async () => { } })

    const closeAlert = () => setAlertConfig(prev => ({ ...prev, open: false }))

    const handleVerify = async (decision: 'yes' | 'no') => {
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/matches/${match.id}/verify?token=${initialToken}&verify=${decision}`, { method: 'POST' })
            if (!res.ok) throw new Error(await res.text())
            toast.success(decision === 'yes' ? 'Match Verified!' : 'Match Disputed')
            setIsVerifyOpen(false)
            window.location.href = `/matches/${match.id}`
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const executeAction = async (action: () => Promise<void>) => {
        try {
            await action()
        } catch (e) {
            // toast handled in action usually
        } finally {
            closeAlert()
        }
    }

    // Effect to open dialog if action indicates report, accept, or verify
    useEffect(() => {
        if (!allowedToSubmit) return

        if (initialAction === 'report' && match.status === 'PENDING') {
            setIsReportOpen(true)
        } else if (initialAction === 'accept' && match.status === 'CHALLENGED') {
            setIsAcceptOpen(true)
        } else if (initialAction === 'verify' && match.status === 'PROCESSING') {
            setIsVerifyOpen(true)
        }
    }, [allowedToSubmit, initialAction, match.status, match.id, initialToken])

    const handleAcceptAction = async (type: 'play' | 'forfeit') => {
        setIsSubmitting(true)
        try {
            // 1. Accept Challenge
            const acceptRes = await fetch(`/api/matches/${match.id}/action?action=accept&token=${initialToken}`, { method: 'POST' })
            if (!acceptRes.ok) throw new Error(await acceptRes.text())

            if (type === 'play') {
                toast.success('Challenge Accepted!')
                window.location.href = `/matches/${match.id}`
                return
            }

            // 2. Submit Result for Forfeit
            const winnerId = player1.id
            const scores = {
                reason: 'forfeit',
                forfeited_by: player2.id
            }

            const reporter = currentUser?.id ?? initialReporterId ?? player2.id

            const resultRes = await fetch(`/api/matches/${match.id}/submit-result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    winner_profile_id: winnerId,
                    reported_by: reporter,
                    token: initialToken,
                    scores
                }),
            })
            if (!resultRes.ok) throw new Error(await resultRes.text())

            toast.success('Result submitted!')
            window.location.href = `/matches/${match.id}`

        } catch (e: any) {
            toast.error(e.message)
            setIsSubmitting(false)
        }
    }

    const handleSimpleWinner = (winnerId: string, winnerName: string) => {
        setAlertConfig({
            open: true,
            title: "Confirm Result",
            description: `Winner: ${winnerName}. Is this correct?`,
            action: async () => {
                setIsSubmitting(true)
                try {
                    const reporter = currentUser?.id ?? initialReporterId
                    const res = await fetch(`/api/matches/${match.id}/submit-result`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            winner_profile_id: winnerId,
                            reported_by: reporter,
                            token: initialToken,
                            scores: []
                        }),
                    })
                    if (!res.ok) throw new Error(await res.text())
                    setIsReportOpen(false)
                    toast.success('Result submitted!')
                    window.location.reload()
                } catch (err: any) {
                    toast.error(`Failed to submit: ${err.message}`)
                } finally {
                    setIsSubmitting(false)
                }
            }
        })
    }

    const handleReport = async (e: React.FormEvent) => {
        e.preventDefault()
        const isSimple = match.sport?.scoring_config?.type === 'simple'

        if (isSimple) return;

        let validScores: ScoreSet[] = []
        let calculatedWinnerId = ''
        let calculatedWinnerName = ''

        if (isSimple) {
            const form = e.target as HTMLFormElement
            const data = new FormData(form)
            calculatedWinnerId = data.get('winner') as string

            if (calculatedWinnerId === player1.id) calculatedWinnerName = player1.full_name || 'Player 1'
            else if (calculatedWinnerId === player2.id) calculatedWinnerName = player2.full_name || 'Player 2'
        } else {
            // Filter out empty sets
            validScores = scores.filter(s => s.p1 !== '' || s.p2 !== '')
            if (validScores.length === 0) {
                toast.error("Please enter at least one set score")
                return
            }

            // Calculate Winner
            let p1Sets = 0
            let p2Sets = 0
            validScores.forEach(s => {
                const s1 = Number(s.p1 || 0)
                const s2 = Number(s.p2 || 0)
                if (s1 > s2) p1Sets++
                else if (s2 > s1) p2Sets++
            })

            if (p1Sets > p2Sets) {
                calculatedWinnerId = player1.id
                calculatedWinnerName = player1.full_name || 'Player 1'
            } else if (p2Sets > p1Sets) {
                calculatedWinnerId = player2.id
                calculatedWinnerName = player2.full_name || 'Player 2'
            } else {
                toast.error("Scores indicate a draw. Please check the scores.")
                return
            }
        }

        // Determine reporter
        const reporter = currentUser?.id ?? initialReporterId

        // Show Confirmation
        setAlertConfig({
            open: true,
            title: "Confirm Result",
            description: isSimple
                ? `Winner: ${calculatedWinnerName}. Is this correct?`
                : `Scores: ${validScores.map(s => `${s.p1}-${s.p2}`).join(', ')}. Winner: ${calculatedWinnerName}. Is this correct?`,
            action: async () => {
                setIsSubmitting(true)
                try {
                    const res = await fetch(`/api/matches/${match.id}/submit-result`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            winner_profile_id: calculatedWinnerId,
                            reported_by: reporter,
                            token: initialToken, // Passed if available
                            scores: validScores // Can be empty for simple
                        }),
                    })
                    if (!res.ok) throw new Error(await res.text())
                    setIsReportOpen(false)
                    toast.success('Result submitted!')
                    window.location.reload()
                } catch (err: any) {
                    toast.error(`Failed to submit: ${err.message}`)
                } finally {
                    setIsSubmitting(false)
                }
            }
        })
    }

    // Determine Roles: Player 1 is ALWAYS Challenger (initiator), Player 2 is Defender
    const p1Label = "Challenger"
    const p2Label = "Defender"

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20'
            case 'pending': return 'bg-amber-500/15 text-amber-600 border-amber-500/20'
            case 'dispute': return 'bg-red-500/15 text-red-600 border-red-500/20'
            default: return 'bg-muted text-muted-foreground'
        }
    }

    const PlayerCard = ({ player, isLeft, isWinner }: { player: Player, isLeft: boolean, isWinner?: boolean }) => {
        const ratingEntry = history?.find((h) => h.player_profile_id === player.id)
        const delta = ratingEntry?.delta

        return (
            <motion.div
                initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className={cn(
                    "relative flex-1 p-6 md:p-8 rounded-3xl border transition-all duration-500 overflow-hidden group",
                    isWinner
                        ? "bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30 shadow-[0_0_50px_-20px_rgba(245,158,11,0.3)]"
                        : "bg-card/40 hover:bg-card/60 border-white/10 backdrop-blur-md",
                    "flex flex-col items-center justify-center gap-4 text-center min-h-[280px]"
                )}
            >
                {/* Winner Glow Effect */}
                {isWinner && (
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 via-transparent to-transparent opacity-50" />
                )}

                {/* Avatar Container */}
                <div className="relative">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className={cn(
                            "rounded-full p-2 bg-background/50 backdrop-blur shadow-2xl",
                            isWinner ? "ring-4 ring-amber-400/50" : "ring-1 ring-white/10"
                        )}
                    >
                        <Avatar className="w-24 h-24 md:w-32 md:h-32 shadow-inner">
                            <AvatarImage src={player.avatar_url} className="object-cover" />
                            <AvatarFallback className="text-4xl font-black bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
                                {player.full_name?.[0] ?? '?'}
                            </AvatarFallback>
                        </Avatar>
                    </motion.div>

                    {isWinner && (
                        <motion.div
                            initial={{ scale: 0, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{ delay: 0.5, type: 'spring' }}
                            className="absolute -top-4 -right-4 bg-gradient-to-br from-amber-400 to-orange-500 text-white p-2.5 rounded-full shadow-lg rotate-12 ring-2 ring-background"
                        >
                            <Trophy className="w-6 h-6 fill-white/20" />
                        </motion.div>
                    )}
                </div>

                {/* Name and Link */}
                <div className="z-10 space-y-2 flex flex-col items-center w-full">
                    <Link href={`/player/${player.id}`} className="group-hover:text-primary transition-colors max-w-full">
                        <h2 className="text-xl md:text-3xl font-black tracking-tight truncate w-full px-2">
                            {player.full_name ?? 'Unknown Player'}
                        </h2>
                    </Link>

                    {/* Role Badge */}
                    <div className="flex flex-wrap justify-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/5 backdrop-blur border-0">
                            {isLeft ? p1Label : p2Label}
                        </Badge>
                        {isWinner && (
                            <Badge className={cn("text-[10px] uppercase tracking-wider animate-pulse shadow-lg", isLeft ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600")}>
                                {isLeft ? "Challenger Won" : "Defender Won"}
                            </Badge>
                        )}
                    </div>


                    {/* Rating Delta Badge */}
                    {delta !== undefined && (
                        <div className={cn(
                            "px-3 py-1 rounded-full text-sm font-bold shadow-sm border flex items-center gap-1 backdrop-blur-md",
                            delta > 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                delta < 0 ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                    "bg-muted/50 text-muted-foreground border-border/50"
                        )}>
                            <TrendingUp className={cn("w-3 h-3", delta < 0 && "rotate-180")} />
                            {delta > 0 ? '+' : ''}{delta} Rating
                        </div>
                    )}
                </div>
            </motion.div>
        )
    }

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background Mesh */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob" />
                <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
                <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8 md:space-y-12 pb-24">
                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" className="gap-2 hover:bg-background/50 hover:text-foreground text-muted-foreground transition-colors" asChild>
                        <Link href="/match-history">
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Link>
                    </Button>

                    <div className="flex items-center gap-3">
                        {allowedToSubmit && match.status === 'PENDING' && (
                            <Button size="sm" onClick={() => setIsReportOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
                                Report Result
                            </Button>
                        )}
                        <Badge variant="outline" className={cn("px-4 py-1.5 text-xs font-bold uppercase tracking-widest backdrop-blur-md bg-background/30", getStatusColor(match.status))}>
                            {match.status}
                        </Badge>
                    </div>
                </div>

                {/* Hero Section */}
                <div className="relative flex flex-col md:flex-row gap-8 md:gap-12 items-center justify-center">
                    <PlayerCard
                        player={player1}
                        isLeft={true}
                        isWinner={winnerId === player1.id}
                    />

                    {/* VS Divider */}
                    <div className="relative z-20 flex flex-col items-center justify-center gap-4 py-4 md:py-0 shrink-0">
                        <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.3, type: 'spring' }}
                            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 flex items-center justify-center shadow-2xl rotate-45 transform ring-4 ring-background/50 backdrop-blur"
                        >
                            <span className="text-2xl md:text-3xl font-black text-background -rotate-45 font-mono">VS</span>
                        </motion.div>
                        <div className="text-center space-y-1 bg-background/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                            <p className="text-[10px] font-bold text-foreground uppercase tracking-[0.2em]">{sportName ?? 'Match'}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{new Date(match.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <PlayerCard
                        player={player2}
                        isLeft={false}
                        isWinner={winnerId === player2.id}
                    />
                </div>

                {/* Result Display: Withdrawn, Forfeit or Scoreboard */}
                {(match.status === 'CANCELLED' && match.scores?.reason === 'withdrawn') ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex justify-center -mt-6 z-30 relative"
                    >
                        <Card className="border-muted bg-muted/40 backdrop-blur shadow-lg">
                            <CardContent className="px-8 py-4 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-base px-3 py-0.5 border-muted-foreground/40 text-muted-foreground">WITHDRAWN</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Challenge withdrawn by {match.scores?.withdrawn_by === player1.id ? player1.full_name : match.scores?.withdrawn_by === player2.id ? player2.full_name : 'player'}
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (match.scores?.reason === 'forfeit' || (Array.isArray(match.scores) && match.scores.some((s: any) => s.reason === 'forfeit'))) ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex justify-center -mt-6 z-30 relative"
                    >
                        <Card className="border-amber-200 bg-amber-50/90 backdrop-blur shadow-lg">
                            <CardContent className="px-8 py-4 flex items-center gap-3">
                                <Clock className="w-5 h-5 text-amber-600" />
                                <div className="text-lg font-bold text-amber-800 uppercase tracking-wide">Won by Forfeit</div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (match.scores && Array.isArray(match.scores) && match.scores.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex justify-center z-30 relative"
                    >
                        <div className="bg-card/30 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden shadow-2xl relative z-20">
                            <div className="bg-background/50 border-b border-white/5 p-4 text-center">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Final Score</h3>
                            </div>
                            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-8 p-4 md:p-6 w-full md:w-auto">
                                {match.scores.map((set: any, i: number) => (
                                    <div key={i} className="flex flex-row md:flex-col items-center justify-between md:justify-center w-full md:w-auto gap-4 md:gap-2 group/score p-3 md:p-0 rounded-xl md:rounded-none bg-background/40 md:bg-transparent border border-white/5 md:border-none">
                                        {/* Mobile Label */}
                                        <span className="md:hidden text-xs font-bold uppercase tracking-widest text-muted-foreground/70">SET {i + 1}</span>

                                        <div className="text-2xl md:text-5xl font-black text-foreground tracking-tighter flex items-center justify-end md:justify-center gap-2 md:gap-0.5">
                                            <span className={cn(
                                                "transition-colors tabular-nums",
                                                Number(set.p1) > Number(set.p2) ? "text-amber-500 text-shadow-glow" : "opacity-70"
                                            )}>{set.p1}</span>
                                            <span className="text-muted-foreground/30 text-lg md:text-3xl font-light">-</span>
                                            <span className={cn(
                                                "transition-colors tabular-nums",
                                                Number(set.p2) > Number(set.p1) ? "text-emerald-500 text-shadow-glow" : "opacity-70"
                                            )}>{set.p2}</span>
                                        </div>

                                        {/* Desktop Label */}
                                        <span className="hidden md:block text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover/score:text-primary transition-colors">SET {i + 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Match Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Time & Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="h-full"
                    >
                        <Card className="h-full border-white/10 bg-card/30 backdrop-blur-md shadow-sm overflow-hidden flex flex-col justify-center">
                            <CardContent className="p-6 md:p-8 flex flex-col items-center justify-center gap-6 text-center h-full">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2 shadow-inner ring-1 ring-primary/20">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Played On</span>
                                    <span className="text-lg md:text-xl font-bold">
                                        {formatMatchDate(match.created_at, { dateStyle: 'full', timeStyle: 'short' })}
                                    </span>
                                </div>
                                <Separator className="bg-border/50 w-1/2" />
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Reporter</span>
                                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full">
                                        <Avatar className="w-5 h-5">
                                            <AvatarImage src="#" /> {/* Could fetch reporter avatar if needed */}
                                            <AvatarFallback className="text-[10px]">R</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">
                                            {match.reported_by === player1.id ? player1.full_name : match.reported_by === player2.id ? player2.full_name : 'Admin/System'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Rank Impact */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="h-full"
                    >
                        <Card className="h-full border-white/10 bg-card/30 backdrop-blur-md shadow-sm overflow-hidden">
                            <CardContent className="p-6 md:p-8">
                                <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-primary" />
                                    Ladder Updates
                                </h3>
                                {rankHistory && rankHistory.length > 0 ? (
                                    <div className="space-y-4">
                                        {rankHistory.map((rh, i) => {
                                            let playerName = 'Unknown'
                                            if (rh.player_profile_id === player1.id) playerName = player1.full_name || 'Challenger'
                                            else if (rh.player_profile_id === player2.id) playerName = player2.full_name || 'Defender'

                                            if (playerName === 'Unknown') return null

                                            const isImprovement = rh.old_rank > rh.new_rank;

                                            return (
                                                <div key={i} className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-white/5 shadow-sm group hover:border-primary/20 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-10 w-10 ring-2 ring-background shadow-md">
                                                            <AvatarFallback className="font-bold text-xs bg-gradient-to-br from-primary/20 to-primary/5 text-primary">{playerName[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-bold text-sm">{playerName}</p>
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{rh.reason}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-muted-foreground font-mono">Rank</div>
                                                            <div className="font-mono font-bold">#{rh.old_rank}</div>
                                                        </div>
                                                        <ArrowRight className={cn("w-4 h-4", isImprovement ? "text-emerald-500" : "text-muted-foreground")} />
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-emerald-600 font-mono">New</div>
                                                            <div className={cn("font-mono font-bold text-lg", isImprovement ? "text-emerald-600" : "text-foreground")}>#{rh.new_rank}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground opacity-50 bg-muted/20 rounded-xl border border-dashed">
                                        <div className="text-sm font-medium">No rank changes recorded</div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>

            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Report Match Result</DialogTitle>
                        <DialogDescription>
                            {match.sport?.scoring_config?.type === 'simple'
                                ? "Who won the match?"
                                : "Enter the final score. The winner is determined automatically."}
                        </DialogDescription>
                    </DialogHeader>

                    {match.sport?.scoring_config?.type === 'simple' ? (
                        <div className="flex flex-col gap-3 py-4">
                            {currentUser?.id === player1.id ? (
                                <>
                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
                                        onClick={() => handleSimpleWinner(player1.id, player1.full_name || 'You')}
                                    >
                                        I Won
                                    </Button>
                                    <Button
                                        className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg font-bold"
                                        onClick={() => handleSimpleWinner(player2.id, player2.full_name || 'Opponent')}
                                    >
                                        I Lost
                                    </Button>
                                </>
                            ) : currentUser?.id === player2.id ? (
                                <>
                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
                                        onClick={() => handleSimpleWinner(player2.id, player2.full_name || 'You')}
                                    >
                                        I Won
                                    </Button>
                                    <Button
                                        className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg font-bold"
                                        onClick={() => handleSimpleWinner(player1.id, player1.full_name || 'Opponent')}
                                    >
                                        I Lost
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-between h-12"
                                        onClick={() => handleSimpleWinner(player1.id, player1.full_name || 'Player 1')}
                                    >
                                        <span>{player1.full_name || 'Player 1'} Won</span>
                                        <Trophy className="w-4 h-4 ml-2" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-between h-12"
                                        onClick={() => handleSimpleWinner(player2.id, player2.full_name || 'Player 2')}
                                    >
                                        <span>{player2.full_name || 'Player 2'} Won</span>
                                        <Trophy className="w-4 h-4 ml-2" />
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleReport} className="space-y-4 pt-4">
                            <div className="border-b pb-4">
                                <ScoreInput
                                    config={match.sport.scoring_config}
                                    player1Name={player1.full_name?.split(' ')[0] ?? 'P1'}
                                    player2Name={player2.full_name?.split(' ')[0] ?? 'P2'}
                                    onChange={setScores}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsReportOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Submitting...' : 'Submit Result'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Verify Match Result</DialogTitle>
                        <DialogDescription>
                            The result has been reported: <strong>{match.winner_id === player1.id ? player1.full_name : player2.full_name} Won</strong>.
                            <br />
                            Is this correct?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="destructive" onClick={() => handleVerify('no')} disabled={isSubmitting}>
                            Dispute Result
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleVerify('yes')} disabled={isSubmitting}>
                            Confirm Result
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAcceptOpen} onOpenChange={setIsAcceptOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Accept Challenge</DialogTitle>
                        <DialogDescription>
                            You have been challenged by <strong>{player1.full_name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
                            onClick={() => handleAcceptAction('play')}
                            disabled={isSubmitting}
                        >
                            Accept & Play
                        </Button>
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-muted"></div>
                            <span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase">Or</span>
                            <div className="flex-grow border-t border-muted"></div>
                        </div>
                        <Button
                            variant="destructive"
                            className="w-full justify-between"
                            onClick={() => handleAcceptAction('forfeit')}
                            disabled={isSubmitting}
                        >
                            Forfeit (I Lose)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={alertConfig.open} onOpenChange={(open) => !open && closeAlert()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertConfig.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={closeAlert}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => executeAction(alertConfig.action)}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}

