import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PendingChallengeItem } from '@/lib/types'
import { Check, AlertCircle } from 'lucide-react'
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
                            <span className="truncate max-w-[40%]">
                                <Link href={`/player/${c.player1.id}`} className="hover:underline">
                                    {c.player1.full_name ?? 'P1'}
                                </Link>
                            </span>
                            <span className="text-muted-foreground text-[10px] uppercase font-bold px-1">vs</span>
                            <span className="truncate max-w-[40%]">
                                <Link href={`/player/${c.player2.id}`} className="hover:underline">
                                    {c.player2.full_name ?? 'P2'}
                                </Link>
                            </span>
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
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full h-8 text-xs flex-1"
                                    onClick={handleAcceptChallenge}
                                >
                                    <Check className="mr-1 h-3 w-3" /> Accept
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500 text-red-600 hover:bg-red-50 h-8 text-xs px-2"
                                    onClick={() => {
                                        setAlertConfig({
                                            open: true,
                                            title: "Forfeit Match",
                                            description: "Are you sure you want to forfeit? This will count as a loss and your rank will drop.",
                                            action: async () => {
                                                const res = await forfeitMatch(c.id)
                                                if (res.success) {
                                                    toast.success("Match forfeited")
                                                    onAction()
                                                }
                                            }
                                        })
                                    }}
                                >
                                    Forfeit (Walkover)
                                </Button>
                            </div>
                        )}

                        {!isReadOnly && c.status === 'CHALLENGED' && c.player1?.id === currentUserId && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    setAlertConfig({
                                        open: true,
                                        title: "Withdraw Challenge",
                                        description: "Are you sure you want to withdraw this challenge? The match will be cancelled.",
                                        action: async () => {
                                            const res = await withdrawChallenge(c.id)
                                            if (res.success) {
                                                toast.success("Challenge withdrawn")
                                                onAction()
                                            }
                                        }
                                    })
                                }}
                            >
                                Withdraw Challenge
                            </Button>
                        )}

                        {!isReadOnly && c.status === 'PENDING' && (
                            <>
                                {c.sports?.scoring_config?.type === 'simple' ? (
                                    <div className="flex gap-2">
                                        {currentUserId === c.player1.id ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 w-full h-8 text-xs flex-1"
                                                    onClick={() => handleSimpleWinner(c.player1.id, c.player1.full_name || 'You')}
                                                >
                                                    I Won
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-red-600 hover:bg-red-700 w-full h-8 text-xs flex-1"
                                                    onClick={() => handleSimpleWinner(c.player2.id, c.player2.full_name || 'Opponent')}
                                                >
                                                    I Lost
                                                </Button>
                                            </>
                                        ) : currentUserId === c.player2.id ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 w-full h-8 text-xs flex-1"
                                                    onClick={() => handleSimpleWinner(c.player2.id, c.player2.full_name || 'You')}
                                                >
                                                    I Won
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-red-600 hover:bg-red-700 w-full h-8 text-xs flex-1"
                                                    onClick={() => handleSimpleWinner(c.player1.id, c.player1.full_name || 'Opponent')}
                                                >
                                                    I Lost
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="flex gap-2 w-full">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full h-8 text-xs flex-1"
                                                    onClick={() => handleSimpleWinner(c.player1.id, c.player1.full_name || 'P1')}
                                                >
                                                    {c.player1.full_name || 'P1'} Won
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full h-8 text-xs flex-1"
                                                    onClick={() => handleSimpleWinner(c.player2.id, c.player2.full_name || 'P2')}
                                                >
                                                    {c.player2.full_name || 'P2'} Won
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <form
                                        className="flex flex-col gap-2 w-full bg-muted/30 p-2 rounded-md border border-border/50"
                                        onSubmit={handleReport}
                                    >
                                        <div className="mb-1 border-b pb-2">
                                            <ScoreInput
                                                config={c.sports.scoring_config}
                                                player1Name={c.player1.full_name ?? 'P1'}
                                                player2Name={c.player2.full_name ?? 'P2'}
                                                onChange={setScores}
                                            />
                                        </div>

                                        <div className="flex justify-between gap-2 mt-1">
                                            {/* Challenger (P1) sees Withdraw */}
                                            {c.player1?.id === currentUserId && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() => {
                                                        setAlertConfig({
                                                            open: true,
                                                            title: "Withdraw from Match",
                                                            description: "Are you sure you want to withdraw? This will cancel the match.",
                                                            action: async () => {
                                                                const res = await withdrawChallenge(c.id)
                                                                if (res.success) {
                                                                    toast.success("Match Cancelled")
                                                                    onAction()
                                                                }
                                                            }
                                                        })
                                                    }}
                                                >
                                                    Withdraw
                                                </Button>
                                            )}

                                            {/* Defender (P2) sees Walkover */}
                                            {c.player2?.id === currentUserId && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() => {
                                                        setAlertConfig({
                                                            open: true,
                                                            title: "Grant Walkover",
                                                            description: "Are you sure you want to grant a walkover? This will count as a loss for you.",
                                                            action: async () => {
                                                                const res = await forfeitMatch(c.id)
                                                                if (res.success) {
                                                                    toast.success("Walkover Granted")
                                                                    onAction()
                                                                }
                                                            }
                                                        })
                                                    }}
                                                >
                                                    Walkover
                                                </Button>
                                            )}

                                            <Button size="sm" type="submit" disabled={isSubmitting} className="h-8 text-xs px-4 ml-auto">
                                                {isSubmitting ? '...' : 'Save'}
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </>
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
                                            onClick={() => handleVerifyAction('yes')}
                                        >
                                            Confirm
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs border-red-500 text-red-600 hover:bg-red-50 w-full"
                                            onClick={confirmDispute}
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
