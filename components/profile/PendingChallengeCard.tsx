import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PendingChallengeItem } from '@/lib/types'
import { Check, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreInput, ScoreSet } from '@/components/matches/ScoreInput'
import { toast } from "sonner"
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
import { withdrawChallenge, forfeitMatch } from '@/lib/actions/matchActions'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

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
    const [alertConfig, setAlertConfig] = useState<{
        open: boolean
        title: string
        description: string
        action: () => Promise<void>
    }>({ open: false, title: '', description: '', action: async () => { } })

    const status = getMatchStatus(c)
    const badgeVariant = getBadgeVariant(status)

    const closeAlert = () => setAlertConfig(prev => ({ ...prev, open: false }))

    const executeAction = async (action: () => Promise<void>) => {
        try {
            await action()
        } catch (e) {
            // toast handled in action usually, or here
        } finally {
            closeAlert()
        }
    }

    const handleAcceptChallenge = async () => {
        const promise = fetch(`/api/matches/${c.id}/action?action=accept&token=${c.action_token}`, { method: 'POST' })
            .then(async (res) => {
                if (!res.ok) throw new Error(await res.text())
                onAction()
            })

        toast.promise(promise, {
            loading: 'Accepting challenge...',
            success: 'Challenge accepted!',
            error: (err) => `Error: ${err.message}`
        })
    }

    const handleVerifyAction = async (verify: 'yes' | 'no') => {
        const promise = fetch(`/api/matches/${c.id}/verify?verify=${verify}&token=${c.action_token}`, { method: 'POST' })
            .then(async (res) => {
                if (!res.ok) throw new Error(await res.text())
                onAction()
            })

        toast.promise(promise, {
            loading: verify === 'yes' ? 'Confirming result...' : 'Disputing result...',
            success: verify === 'yes' ? 'Result confirmed!' : 'Result disputed via email.',
            error: (err) => `Error: ${err.message}`
        })
    }



    const confirmDispute = () => {
        setAlertConfig({
            open: true,
            title: "Dispute Result?",
            description: "Are you sure you want to dispute this result? This will notify the admin.",
            action: async () => handleVerifyAction('no')
        })
    }

    const handleSimpleWinner = (winnerId: string, winnerName: string) => {
        setAlertConfig({
            open: true,
            title: "Confirm Result",
            description: `Winner: ${winnerName}. Is this correct?`,
            action: async () => {
                setIsSubmitting(true)
                try {
                    const res = await fetch(`/api/matches/${c.id}/submit-result`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            winner_profile_id: winnerId,
                            reported_by: currentUserId,
                            token: c.action_token,
                            scores: []
                        }),
                    })
                    if (!res.ok) throw new Error(await res.text())
                    toast.success('Result submitted!')
                    onAction()
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
        const isSimple = c.sports?.scoring_config?.type === 'simple'

        if (isSimple) return;

        let validScores: ScoreSet[] = []
        let calculatedWinnerId = ''
        let calculatedWinnerName = ''

        if (isSimple) {
            const form = e.target as HTMLFormElement
            const data = new FormData(form)
            calculatedWinnerId = data.get('winner') as string

            if (calculatedWinnerId === c.player1.id) calculatedWinnerName = c.player1.full_name || 'Player 1'
            else if (calculatedWinnerId === c.player2.id) calculatedWinnerName = c.player2.full_name || 'Player 2'
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
                calculatedWinnerId = c.player1.id
                calculatedWinnerName = c.player1.full_name || 'Player 1'
            } else if (p2Sets > p1Sets) {
                calculatedWinnerId = c.player2.id
                calculatedWinnerName = c.player2.full_name || 'Player 2'
            } else {
                toast.error("Scores indicate a draw. Please check the scores.")
                return
            }
        }

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
                    const res = await fetch(`/api/matches/${c.id}/submit-result`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            winner_profile_id: calculatedWinnerId,
                            reported_by: currentUserId,
                            token: c.action_token,
                            scores: validScores
                        }),
                    })
                    if (!res.ok) throw new Error(await res.text())
                    toast.success('Result submitted!')
                    onAction()
                } catch (err: any) {
                    toast.error(`Failed to submit: ${err.message}`)
                } finally {
                    setIsSubmitting(false)
                }
            }
        })
    }

    return (
        <>
            <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-muted/20 backdrop-blur-md shadow-sm transition-all hover:shadow-md">

                {/* Status Strip */}
                <div className={cn(
                    "h-1 w-full",
                    status === 'Challenged' && "bg-blue-500",
                    status === 'Won' && "bg-emerald-500",
                    status === 'Lost' && "bg-red-500",
                    status === 'Pending Result' && "bg-amber-500",
                )} />

                <div className="p-3 space-y-3">
                    {/* Header: Status & Date */}
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className={cn(
                            "h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider border-0 shadow-none",
                            status === 'Challenged' && "bg-blue-500/10 text-blue-600",
                            status === 'Won' && "bg-emerald-500/10 text-emerald-600",
                            status === 'Lost' && "bg-red-500/10 text-red-600",
                            status === 'Pending Result' && "bg-amber-500/10 text-amber-600",
                        )}>
                            {status}
                        </Badge>
                        <span className="text-[10px] font-medium text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                    </div>

                    {/* Players Row - Compact */}
                    <div className="flex items-center justify-between gap-3">
                        {/* Player 1 */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0">
                                {c.player1.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <Link href={`/player/${c.player1.id}`} className="font-bold text-xs truncate hover:text-primary transition-colors">
                                    {c.player1.full_name?.split(' ')[0] ?? 'P1'}
                                </Link>
                                {c.player1.id === currentUserId && <span className="text-[9px] text-muted-foreground leading-none">(You)</span>}
                            </div>
                        </div>

                        {/* VS */}
                        <div className="text-[9px] font-black text-muted-foreground/50 italic shrink-0">VS</div>

                        {/* Player 2 */}
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                            <div className="flex flex-col min-w-0 items-end">
                                <Link href={`/player/${c.player2.id}`} className="font-bold text-xs truncate hover:text-primary transition-colors">
                                    {c.player2.full_name?.split(' ')[0] ?? 'P2'}
                                </Link>
                                {c.player2.id === currentUserId && <span className="text-[9px] text-muted-foreground leading-none">(You)</span>}
                            </div>
                            <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-xs font-black text-indigo-600 shrink-0">
                                {c.player2.full_name?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>

                    {/* Message */}
                    {c.message && (
                        <div className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded truncate">
                            "{c.message}"
                        </div>
                    )}

                    {/* Action Area */}
                    {!isReadOnly && (
                        <div className="pt-2 border-t border-border/30">
                            {/* Challenged - Receive */}
                            {c.status === 'CHALLENGED' && c.player2?.id === currentUserId && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleAcceptChallenge}>
                                        Accept
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={() => setAlertConfig({
                                        open: true, title: "Forfeit", description: "Confirm forfeit?", action: async () => { await forfeitMatch(c.id); onAction() }
                                    })}>
                                        Decline
                                    </Button>
                                </div>
                            )}

                            {/* Challenged - Sent */}
                            {c.status === 'CHALLENGED' && c.player1?.id === currentUserId && (
                                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setAlertConfig({
                                    open: true, title: "Withdraw", description: "Withdraw this challenge?", action: async () => { await withdrawChallenge(c.id); onAction() }
                                })}>
                                    Withdraw Request
                                </Button>
                            )}

                            {/* Pending - Report */}
                            {c.status === 'PENDING' && (
                                c.sports?.scoring_config?.type === 'simple' ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button size="sm" className="h-7 text-xs bg-emerald-600" onClick={() => handleSimpleWinner(currentUserId === c.player1.id ? c.player1.id : c.player2.id, 'You')}>I Won</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs hover:bg-red-50 text-red-600 border-red-200" onClick={() => handleSimpleWinner(currentUserId === c.player1.id ? c.player2.id : c.player1.id, 'Opponent')}>I Lost</Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleReport} className="space-y-2">
                                        <div className="bg-muted/30 p-2 rounded-lg">
                                            <ScoreInput config={c.sports.scoring_config} player1Name={c.player1.full_name ?? 'P1'} player2Name={c.player2.full_name ?? 'P2'} onChange={setScores} />
                                        </div>
                                        <Button type="submit" size="sm" disabled={isSubmitting} className="w-full h-7 text-xs font-bold">
                                            {isSubmitting ? '...' : 'Submit Score'}
                                        </Button>
                                    </form>
                                )
                            )}

                            {/* Processing */}
                            {c.status === 'PROCESSING' && (
                                c.reported_by?.id !== currentUserId ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button size="sm" className="h-7 text-xs bg-emerald-600" onClick={() => handleVerifyAction('yes')}>Confirm</Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={confirmDispute}>Dispute</Button>
                                    </div>
                                ) : (
                                    <div className="text-center text-[10px] text-muted-foreground animate-pulse">
                                        Waiting for opponent confirmation...
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog open={alertConfig.open} onOpenChange={(open) => !open && closeAlert()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertConfig.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alertConfig.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={closeAlert}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => executeAction(alertConfig.action)}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
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
