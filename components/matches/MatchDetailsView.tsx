'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Trophy, Medal, ArrowLeft, Swords, Clock, Hash, TrendingUp, ArrowRight } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
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

    // Effect to open dialog if action indicates report
    useEffect(() => {
        if (allowedToSubmit && initialAction === 'report' && match.status === 'PENDING') {
            setIsReportOpen(true)
        }
    }, [allowedToSubmit, initialAction, match.status])

    const handleReport = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        const form = e.target as HTMLFormElement
        const data = new FormData(form)
        const winner = data.get('winner') as string

        // Filter out empty sets
        const validScores = scores.filter(s => s.p1 !== '' || s.p2 !== '')

        // Determine reporter: if using token, use initialReporterId or rely on backend default (winner)
        // If logged in, use currentUser.id
        const reporter = currentUser?.id ?? initialReporterId

        const promise = fetch(`/api/matches/${match.id}/submit-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                winner_profile_id: winner,
                reported_by: reporter,
                token: initialToken, // Passed if available
                scores: validScores.length > 0 ? validScores : undefined
            }),
        }).then(async (res) => {
            if (!res.ok) throw new Error(await res.text())
            setIsReportOpen(false)
            // Ideally revalidate path or reload
            window.location.reload()
        })

        toast.promise(promise, {
            loading: 'Submitting result...',
            success: 'Result submitted!',
            error: (err) => `Failed to submit: ${err.message}`
        })

        try {
            await promise
        } catch {
            // ignored
        } finally {
            setIsSubmitting(false)
        }
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
                    "relative flex-1 p-8 rounded-2xl border transition-all duration-500 overflow-hidden group",
                    isWinner
                        ? "bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/30 shadow-[0_0_30px_-10px_rgba(245,158,11,0.3)]"
                        : "bg-card/50 hover:bg-card border-border/50",
                    "flex flex-col items-center justify-center gap-4 text-center min-h-[300px]"
                )}
            >
                {/* Winner Glow Effect */}
                {isWinner && (
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 via-transparent to-transparent opacity-50" />
                )}

                {/* Avatar Container */}
                <div className="relative">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className={cn(
                            "rounded-full p-2 bg-background shadow-xl",
                            isWinner ? "ring-4 ring-amber-400/50" : "ring-1 ring-border"
                        )}
                    >
                        <Avatar className="w-32 h-32">
                            <AvatarImage src={player.avatar_url} className="object-cover" />
                            <AvatarFallback className="text-4xl font-bold bg-muted text-muted-foreground">
                                {player.full_name?.[0] ?? '?'}
                            </AvatarFallback>
                        </Avatar>
                    </motion.div>

                    {isWinner && (
                        <motion.div
                            initial={{ scale: 0, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{ delay: 0.5, type: 'spring' }}
                            className="absolute -top-6 -right-6 bg-amber-500 text-white p-3 rounded-full shadow-lg rotate-12"
                        >
                            <Trophy className="w-8 h-8 fill-yellow-200 text-yellow-100" />
                        </motion.div>
                    )}
                </div>

                {/* Name and Link */}
                <div className="z-10 space-y-2 flex flex-col items-center">
                    <Link href={`/player/${player.id}`} className="group-hover:text-primary transition-colors">
                        <h2 className="text-3xl font-bold tracking-tight">
                            {player.full_name ?? 'Unknown Player'}
                        </h2>
                    </Link>

                    {/* Role Badge */}
                    <div className="flex gap-2 mb-2">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-background/50 backdrop-blur">
                            {isLeft ? p1Label : p2Label}
                        </Badge>
                        {isWinner && (
                            <Badge className={cn("text-[10px] uppercase tracking-wider animate-pulse", isLeft ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600")}>
                                {isLeft ? "Challenger Won" : "Defender Won"}
                            </Badge>
                        )}
                    </div>


                    {/* Rating Delta Badge */}
                    {delta !== undefined && (
                        <div className={cn(
                            "px-3 py-1 rounded-full text-sm font-bold shadow-sm border flex items-center gap-1",
                            delta > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                delta < 0 ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" :
                                    "bg-muted text-muted-foreground border-border"
                        )}>
                            {delta > 0 ? '+' : ''}{delta} Rating
                        </div>
                    )}

                    {isWinner && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 animate-pulse mt-2">
                            Winner
                        </Badge>
                    )}
                </div>
            </motion.div>
        )
    }

    return (
        <div className="min-h-screen bg-background/50">
            <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" className="gap-2 hover:bg-muted/50 -ml-4 text-muted-foreground" asChild>
                        <Link href="/match-history">
                            <ArrowLeft className="w-4 h-4" />
                            Back to History
                        </Link>
                    </Button>

                    <div className="flex items-center gap-3">
                        {allowedToSubmit && match.status === 'PENDING' && (
                            <Button size="sm" onClick={() => setIsReportOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                Report Result
                            </Button>
                        )}
                        <Badge variant="outline" className={cn("px-4 py-1.5 text-sm font-medium uppercase tracking-widest", getStatusColor(match.status))}>
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
                    <div className="relative z-20 flex flex-col items-center justify-center gap-4 py-8 md:py-0">
                        <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.3, type: 'spring' }}
                            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-2xl rotate-45 transform"
                        >
                            <span className="text-3xl font-black text-primary-foreground -rotate-45 font-mono">VS</span>
                        </motion.div>
                        <div className="text-center space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">{sportName ?? 'Match'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{new Date(match.created_at).toLocaleDateString()}</p>
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
                        className="flex justify-center -mt-6 z-30 relative"
                    >
                        <Card className="border-border/50 bg-card/80 backdrop-blur shadow-lg">
                            <CardContent className="p-4 flex items-center gap-6">
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">Final Score</div>
                                <div className="flex items-center gap-4">
                                    {match.scores.map((set: any, i: number) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <div className="text-2xl font-black font-mono leading-none tracking-tighter">
                                                <span className={cn(Number(set.p1) > Number(set.p2) ? "text-foreground" : "text-muted-foreground")}>{set.p1}</span>
                                                <span className="text-muted-foreground/30 mx-1">-</span>
                                                <span className={cn(Number(set.p2) > Number(set.p1) ? "text-foreground" : "text-muted-foreground")}>{set.p2}</span>
                                            </div>
                                            {(match.scores.length > 1) && <span className="text-[10px] text-muted-foreground uppercase mt-1">Set {i + 1}</span>}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Match Details Card */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="border-muted bg-card/30 backdrop-blur-sm shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                                <div className="p-6 flex flex-col items-center justify-center gap-2 text-center hover:bg-muted/30 transition-colors">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">Match Date</span>
                                    <span className="text-lg font-semibold">{new Date(match.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                </div>

                                <div className="p-6 flex flex-col items-center justify-center gap-2 text-center hover:bg-muted/30 transition-colors">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                                        <Swords className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">Sport Category</span>
                                    <span className="text-lg font-semibold">{sportName ?? 'Ladder Match'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Rank History Changes */}
                {rankHistory && rankHistory.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <Card className="border-muted bg-card/30 backdrop-blur-sm shadow-sm overflow-hidden">
                            <CardContent className="p-6">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Ladder Impact
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {rankHistory.map((rh, i) => {
                                        let playerName = 'Unknown'
                                        if (rh.player_profile_id === player1.id) playerName = player1.full_name || 'Challenger'
                                        else if (rh.player_profile_id === player2.id) playerName = player2.full_name || 'Defender'

                                        if (playerName === 'Unknown') return null

                                        return (
                                            <div key={i} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarFallback>{playerName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-semibold">{playerName}</p>
                                                        <p className="text-xs text-muted-foreground">{rh.reason}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm font-mono">
                                                    <span className="text-muted-foreground">#{rh.old_rank}</span>
                                                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                                    <span className="font-bold text-foreground">#{rh.new_rank}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>

            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Report Match Result</DialogTitle>
                        <DialogDescription>
                            Enter the final score and select the winner.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleReport} className="space-y-4 pt-4">
                        {match.sport?.scoring_config?.type && match.sport.scoring_config.type !== 'simple' && (
                            <div className="border-b pb-4">
                                <ScoreInput
                                    config={match.sport.scoring_config}
                                    player1Name={player1.full_name?.split(' ')[0] ?? 'P1'}
                                    player2Name={player2.full_name?.split(' ')[0] ?? 'P2'}
                                    onChange={setScores}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Winner</label>
                            <Select name="winner" defaultValue={initialWinnerId} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select who won" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={player1.id}>{player1.full_name ?? 'Player 1'}</SelectItem>
                                    <SelectItem value={player2.id}>{player2.full_name ?? 'Player 2'}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsReportOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : 'Submit Result'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div >
    )
}
