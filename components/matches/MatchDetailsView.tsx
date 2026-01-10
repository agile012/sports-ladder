'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Trophy, Medal, ArrowLeft, Swords, Clock, Hash } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

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
}

export default function MatchDetailsView({
    match,
    player1,
    player2,
    sportName,
    currentUser,
    allowedToSubmit
}: MatchDetailsProps) {
    const winnerId = match.winner_id

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20'
            case 'pending': return 'bg-amber-500/15 text-amber-600 border-amber-500/20'
            case 'dispute': return 'bg-red-500/15 text-red-600 border-red-500/20'
            default: return 'bg-muted text-muted-foreground'
        }
    }

    const PlayerCard = ({ player, isLeft, isWinner }: { player: Player, isLeft: boolean, isWinner?: boolean }) => (
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
            <div className="z-10 space-y-2">
                <Link href={`/player/${player.id}`} className="group-hover:text-primary transition-colors">
                    <h2 className="text-3xl font-bold tracking-tight">
                        {player.full_name ?? 'Unknown Player'}
                    </h2>
                </Link>
                {isWinner && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 animate-pulse">
                        Winner
                    </Badge>
                )}
            </div>
        </motion.div>
    )

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

                    <Badge variant="outline" className={cn("px-4 py-1.5 text-sm font-medium uppercase tracking-widest", getStatusColor(match.status))}>
                        {match.status}
                    </Badge>
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

                {/* Match Details Card */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="border-muted bg-card/30 backdrop-blur-sm shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/50">

                                <div className="p-6 flex flex-col items-center justify-center gap-2 text-center hover:bg-muted/30 transition-colors">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">Match Date</span>
                                    <span className="text-lg font-semibold">{new Date(match.created_at).toLocaleString()}</span>
                                </div>

                                <div className="p-6 flex flex-col items-center justify-center gap-2 text-center hover:bg-muted/30 transition-colors">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                                        <Swords className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">Sport Category</span>
                                    <span className="text-lg font-semibold">{sportName ?? 'Ladder Match'}</span>
                                </div>

                                <div className="p-6 flex flex-col items-center justify-center gap-2 text-center hover:bg-muted/30 transition-colors">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                                        <Hash className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">Match ID</span>
                                    <span className="text-sm font-mono text-foreground/80 bg-muted px-2 py-1 rounded select-all">{match.id}</span>
                                </div>

                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
