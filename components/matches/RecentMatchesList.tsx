
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Activity, ArrowRight, Calendar, Trophy, Swords, Clock } from 'lucide-react'
import { MatchWithPlayers, Sport } from '@/lib/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn, formatMatchDate } from '@/lib/utils'

interface RecentMatchesListProps {
    matches: MatchWithPlayers[]
    sport: Sport
}

export default function RecentMatchesList({ matches, sport }: RecentMatchesListProps) {
    if (matches.length === 0) {
        return (
            <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Recent Activity
                    </h3>
                </div>
                <div className="p-8 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/20 text-sm flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-muted/50 mb-2">
                        <Swords className="w-5 h-5 opacity-50" />
                    </div>
                    No recent matches for {sport.name}.
                    <br />
                    Be the first to challenge someone!
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 mb-8">
            {/* Header omitted here as it's usually handled by parent, but if standalone: */}
            {/* <div className="flex items-center justify-between mb-2">...</div> */}

            <div className="grid gap-4">
                {matches.map((m, i) => {
                    const isWinnerP1 = m.winner_id === m.player1?.id
                    const isWinnerP2 = m.winner_id === m.player2?.id
                    const isDraw = m.status === 'COMPLETED' && !m.winner_id

                    return (
                        <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + (i * 0.05) }}
                        >
                            <Link href={`/matches/${m.id}`} className="block group">
                                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md hover:bg-card/60 transition-all duration-300">
                                    {/* Background decoration */}
                                    <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-primary/10 transition-colors" />

                                    <div className="p-5 flex flex-col gap-4">
                                        {/* Header: Date + Status */}
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1.5 font-medium bg-secondary/50 px-2 py-0.5 rounded-md">
                                                <Calendar className="w-3 h-3" />
                                                {formatMatchDate(m.created_at, { month: 'short', day: 'numeric' })}
                                            </span>
                                            {m.status === 'PENDING' ? (
                                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">Pending</Badge>
                                            ) : m.status === 'COMPLETED' ? (
                                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">Final</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">{m.status}</Badge>
                                            )}
                                        </div>

                                        {/* Players VS */}
                                        <div className="flex items-center justify-between gap-2">
                                            {/* Player 1 */}
                                            <div className="flex-1 flex flex-col items-center text-center gap-2 min-w-0">
                                                <div className="relative">
                                                    <Avatar className={cn(
                                                        "w-12 h-12 border-2 shadow-sm transition-transform group-hover:scale-105",
                                                        isWinnerP1 ? "border-amber-500 ring-2 ring-amber-500/20" : "border-background"
                                                    )}>
                                                        <AvatarImage src={m.player1?.avatar_url} />
                                                        <AvatarFallback>{m.player1?.full_name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    {isWinnerP1 && (
                                                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5">
                                                            <Trophy className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-full">
                                                    <div className={cn("font-bold text-sm truncate", isWinnerP1 && "text-amber-600 dark:text-amber-400")}>
                                                        {m.player1?.full_name?.split(' ')[0]}
                                                    </div>
                                                    {m.player1?.ladder_rank && <div className="text-[10px] text-muted-foreground">#{m.player1.ladder_rank}</div>}
                                                </div>
                                            </div>

                                            {/* VS / Score */}
                                            <div className="flex flex-col items-center justify-center min-w-[60px] md:min-w-[80px]">
                                                {m.scores && Array.isArray(m.scores) && m.scores.length > 0 ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="text-xl font-black font-mono tracking-tighter flex items-center gap-1">
                                                            <span className={cn(isWinnerP1 ? "text-foreground" : "text-muted-foreground")}>{m.scores[0].p1}</span>
                                                            <span className="text-xs text-muted-foreground/50">-</span>
                                                            <span className={cn(isWinnerP2 ? "text-foreground" : "text-muted-foreground")}>{m.scores[0].p2}</span>
                                                        </div>
                                                        {m.scores.length > 1 && <span className="text-[9px] text-muted-foreground uppercase">+ {m.scores.length - 1} sets</span>}
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                                                        <span className="text-[10px] font-black italic text-muted-foreground">VS</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Player 2 */}
                                            <div className="flex-1 flex flex-col items-center text-center gap-2 min-w-0">
                                                <div className="relative">
                                                    <Avatar className={cn(
                                                        "w-12 h-12 border-2 shadow-sm transition-transform group-hover:scale-105",
                                                        isWinnerP2 ? "border-amber-500 ring-2 ring-amber-500/20" : "border-background"
                                                    )}>
                                                        <AvatarImage src={m.player2?.avatar_url} />
                                                        <AvatarFallback>{m.player2?.full_name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    {isWinnerP2 && (
                                                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5">
                                                            <Trophy className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-full">
                                                    <div className={cn("font-bold text-sm truncate", isWinnerP2 && "text-amber-600 dark:text-amber-400")}>
                                                        {m.player2?.full_name?.split(' ')[0]}
                                                    </div>
                                                    {m.player2?.ladder_rank && <div className="text-[10px] text-muted-foreground">#{m.player2.ladder_rank}</div>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Result Text (if special case) */}
                                        {((m.status === 'CANCELLED' && (m.scores as any)?.reason === 'withdrawn') || (m.scores as any)?.reason === 'forfeit') && (
                                            <div className="text-center pt-2 border-t border-dashed border-border/50">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {(m.scores as any)?.reason === 'forfeit' ? 'Won by Forfeit' : 'Match Withdrawn'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>

                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
