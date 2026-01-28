
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Activity, ArrowRight, Calendar, Trophy } from 'lucide-react'
import { MatchWithPlayers, Sport } from '@/lib/types'

interface RecentMatchesListProps {
    matches: MatchWithPlayers[]
    sport: Sport
}

export default function RecentMatchesList({ matches, sport }: RecentMatchesListProps) {
    return (
        <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Recent Activity
                </h3>
                <Link
                    href={`/match-history?sport=${sport.id}`}
                    className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors group"
                >
                    View history <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </div>

            <div className="grid gap-3">
                {matches.length === 0 && (
                    <div className="p-6 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/20 text-sm">
                        No recent matches for {sport.name}
                    </div>
                )}
                {matches.map((m, i) => (
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
        </div>
    )
}
