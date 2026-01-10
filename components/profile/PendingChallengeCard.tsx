'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PendingChallengeItem } from '@/lib/types'
import { Check, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreInput, ScoreSet } from '@/components/matches/ScoreInput'

const statusMap: Record<string, string> = {
    PENDING: 'Pending Result',
    CHALLENGED: 'Challenged',
    PROCESSING: 'Reviewing Result',
}

const getMatchStatus = (match: PendingChallengeItem) => {
    if (match.result === 'win') return 'Won'
    if (match.result === 'loss') return 'Lost'
    return statusMap[match.status] || match.status
}

const getBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
        case 'Won': return 'success' as any
        case 'Lost': return 'destructive'
        case 'Challenged': return 'default'
        case 'Pending Result': return 'secondary'
        default: return 'outline'
    }
}

export default function PendingChallengeCard({
    challenge: c,
    currentUserId,
    onAction,
    isReadOnly
}: {
    challenge: PendingChallengeItem
    currentUserId: string | undefined
    onAction: () => void
    isReadOnly: boolean
}) {
    const [scores, setScores] = useState<ScoreSet[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    const status = getMatchStatus(c)
    const badgeVariant = getBadgeVariant(status)

    const handleReport = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        const form = e.target as HTMLFormElement
        const data = new FormData(form)
        const winner = data.get('winner') as string

        // Filter out empty sets
        const validScores = scores.filter(s => s.p1 !== '' || s.p2 !== '')

        try {
            await fetch(`/api/matches/${c.id}/submit-result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    winner_profile_id: winner,
                    reported_by: currentUserId,
                    token: c.action_token,
                    scores: validScores.length > 0 ? validScores : undefined
                }),
            })
            onAction()
        } catch (err) {
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }
    console.log("Type", c.sports)
    return (
        <div className="group relative overflow-hidden rounded-lg border bg-background p-4 transition-all hover:shadow-md">
            <div className="flex flex-col gap-3">

                {/* Match Info */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Badge variant={badgeVariant as any} className={cn(
                            "font-semibold text-xs px-2 py-0.5",
                            status === 'Challenged' && "bg-blue-500 hover:bg-blue-600",
                            status === 'Won' && "bg-emerald-500 hover:bg-emerald-600",
                        )}>
                            {status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="font-semibold text-sm flex gap-2 items-center">
                        <span className="truncate max-w-[40%]">{c.player1.full_name?.split(' ')[0] ?? 'P1'}</span>
                        <span className="text-muted-foreground text-[10px] uppercase font-bold px-1">vs</span>
                        <span className="truncate max-w-[40%]">{c.player2.full_name?.split(' ')[0] ?? 'P2'}</span>
                    </div>

                    {c.message && (
                        <div className="text-xs text-muted-foreground italic truncate">
                            "{c.message}"
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full mt-1">
                    {!isReadOnly && c.status === 'CHALLENGED' && c.player2?.id === currentUserId && (
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full h-8 text-xs"
                                onClick={() =>
                                    window.fetch(`/api/matches/${c.id}/action?action=accept&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                                }
                            >
                                <Check className="mr-1 h-3 w-3" /> Accept
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                className='bg-red-500 hover:bg-red-600 w-full h-8 text-xs'
                                onClick={() =>
                                    window.fetch(`/api/matches/${c.id}/action?action=reject&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                                }
                            >
                                <X className="mr-1 h-3 w-3" /> Reject
                            </Button>
                        </div>
                    )}

                    {!isReadOnly && c.status === 'PENDING' && (
                        <form
                            className="flex flex-col gap-2 w-full bg-muted/30 p-2 rounded-md border border-border/50"
                            onSubmit={handleReport}
                        >
                            {c.sports?.scoring_config?.type && c.sports.scoring_config.type !== 'simple' && (
                                <div className="mb-1 border-b pb-2">
                                    <ScoreInput
                                        config={c.sports.scoring_config}
                                        player1Name={c.player1.full_name?.split(' ')[0] ?? 'P1'}
                                        player2Name={c.player2.full_name?.split(' ')[0] ?? 'P2'}
                                        onChange={setScores}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-[1fr,auto] gap-2">
                                <Select name="winner" required>
                                    <SelectTrigger className="h-8 text-xs w-full bg-background">
                                        <SelectValue placeholder="Winner?" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={c.player1.id}>{c.player1.full_name ?? 'Player 1'}</SelectItem>
                                        <SelectItem value={c.player2.id}>{c.player2.full_name ?? 'Player 2'}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="sm" type="submit" disabled={isSubmitting} className="h-8 text-xs px-3">
                                    {isSubmitting ? '...' : 'Save'}
                                </Button>
                            </div>
                        </form>
                    )}

                    {!isReadOnly && c.status === 'PROCESSING' &&
                        (c.reported_by?.id !== currentUserId ? (
                            <div className="flex flex-col gap-2">
                                <div className={cn(
                                    "px-2 py-1 rounded text-xs font-bold text-center",
                                    c.winner_id === currentUserId ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                    {c.winner_id === currentUserId ? 'Opponent says you Won' : 'Opponent says you Lost'}
                                </div>

                                {/* Show scores if available */}
                                {c.scores && Array.isArray(c.scores) && c.scores.length > 0 && (
                                    <div className="text-xs text-center font-mono py-1 bg-muted/40 rounded border border-border/50">
                                        {c.scores.map((s: any, i) => (
                                            <span key={i} className="mx-1">
                                                {s.p1}-{s.p2}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50 w-full"
                                        onClick={() =>
                                            window.fetch(`/api/matches/${c.id}/verify?verify=yes&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                                        }
                                    >
                                        Confirm
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs border-red-500 text-red-600 hover:bg-red-50 w-full"
                                        onClick={() =>
                                            window.fetch(`/api/matches/${c.id}/verify?verify=no&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                                        }
                                    >
                                        Dispute
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground flex items-center justify-center gap-1 py-1 bg-muted/50 rounded">
                                <LoaderIcon className="h-3 w-3 animate-spin" />
                                Waiting for confirmation
                            </span>
                        ))}
                </div>
            </div>
        </div>
    )
}

function LoaderIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
