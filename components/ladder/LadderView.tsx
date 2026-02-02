'use client'

import { RankedPlayerProfile, Sport } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Swords, Shield, Medal } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface LadderViewProps {
    players: RankedPlayerProfile[]
    user: any
    challengables: Set<string>
    submittingChallenge: string | null
    handleChallenge: (opponentId: string) => void
    selectedSport: Sport
}

export default function LadderView({
    players,
    user,
    challengables,
    submittingChallenge,
    handleChallenge,
    selectedSport
}: LadderViewProps) {
    const [challengeTarget, setChallengeTarget] = useState<string | null>(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)

    // Empty State
    if (players.length === 0) {
        return (
            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-muted">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium">No players yet</h3>
                <p className="text-muted-foreground">Be the first to join the {selectedSport.name} ladder!</p>
            </div>
        )
    }

    // Animation variants
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    }

    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-3 pb-20 md:pb-0" // Padding for mobile nav
        >
            {players.map((player, index) => {
                const isMe = user?.id === player.user_id
                const isChallengable = challengables.has(player.id)
                const rank = index + 1

                // Rank Badge Color
                let rankColor = "bg-muted text-muted-foreground"
                let icon = null
                if (rank === 1) { rankColor = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700"; icon = <Medal className="h-3 w-3 mr-1" /> }
                if (rank === 2) { rankColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200"; icon = <Medal className="h-3 w-3 mr-1" /> }
                if (rank === 3) { rankColor = "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200"; icon = <Medal className="h-3 w-3 mr-1" /> }

                return (
                    <motion.div variants={item} key={player.id}>
                        <Card className={cn(
                            "p-3 flex items-center gap-3 overflow-hidden relative border",
                            isMe ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-muted/50 transition-colors"
                        )}>
                            {/* Rank */}
                            <div className="flex-shrink-0 w-8 flex justify-center">
                                <span className={cn("text-lg font-black tabular-nums tracking-tighter",
                                    rank <= 3 ? "text-foreground scale-110" : "text-muted-foreground"
                                )}>
                                    {rank}
                                </span>
                            </div>

                            {/* Avatar & Info (Clickable) */}
                            <Link href={`/player/${player.id}`} className="flex-grow min-w-0 flex items-center gap-3 group cursor-pointer">
                                <Avatar className={cn("h-10 w-10 border-2 transition-transform group-hover:scale-105",
                                    isMe ? "border-primary" : "border-background"
                                )}>
                                    <AvatarImage src={player.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs font-bold">{player.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>

                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold truncate text-sm md:text-base group-hover:text-primary transition-colors">
                                            {player.full_name} {isMe && <span className="text-xs text-muted-foreground font-normal">(You)</span>}
                                        </h3>
                                        {rank === 1 && <Trophy className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">{player.rating} Elo</span>
                                        <span>•</span>
                                        <span>{player.matches_played} Matches</span>
                                    </div>
                                </div>
                            </Link>

                            {/* Action Button */}
                            <div className="flex-shrink-0">
                                {isMe ? (
                                    <Badge variant="outline" className="bg-background/50">You</Badge>
                                ) : (
                                    <>
                                        {isChallengable ? (
                                            <Button
                                                size="sm"
                                                className="font-bold h-8 px-3 shadow-lg shadow-primary/10"
                                                onClick={() => {
                                                    setChallengeTarget(player.id)
                                                    setIsConfirmOpen(true)
                                                }}
                                                disabled={submittingChallenge !== null}
                                            >
                                                <Swords className="h-4 w-4 md:mr-1.5" />
                                                <span className="hidden md:inline">Challenge</span>
                                            </Button>
                                        ) : (
                                            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-50 cursor-not-allowed" disabled>
                                                <Shield className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </>
                                )}
                                {selectedSport.is_paused && (
                                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                                        <Badge variant="destructive" className="font-bold shadow-lg">PAUSED</Badge>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                )
            })}
            <ConfirmDialog
                open={isConfirmOpen}
                onOpenChange={setIsConfirmOpen}
                title="Send Challenge"
                description="Are you sure you want to challenge this player? They will be notified immediately."
                confirmLabel="Send Challenge"
                onConfirm={() => {
                    if (challengeTarget) handleChallenge(challengeTarget)
                }}
            />
        </motion.div >
    )
}
