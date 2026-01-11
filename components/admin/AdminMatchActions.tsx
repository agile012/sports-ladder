'use client'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
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
import { cancelMatch, updateMatchResult, processMatchElo } from '@/lib/actions/admin'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { ScoreInput, ScoreSet, ScoringConfig } from '@/components/matches/ScoreInput'
import { toast } from "sonner"

type Props = {
    matchId: string
    currentStatus: string
    currentWinnerId: string | null
    currentScores?: any
    p1Id: string
    p2Id: string
    p1Name?: string
    p2Name?: string
    scoringConfig?: ScoringConfig
}

export default function AdminMatchActions({ matchId, currentStatus, currentWinnerId, currentScores, p1Id, p2Id, p1Name, p2Name, scoringConfig }: Props) {
    const [loading, setLoading] = useState(false)
    const [showScoreDialog, setShowScoreDialog] = useState(false)
    const [scores, setScores] = useState<ScoreSet[]>([{ p1: '', p2: '' }])

    const [alertConfig, setAlertConfig] = useState<{
        open: boolean
        title: string
        description: string
        action: () => Promise<void>
    }>({ open: false, title: '', description: '', action: async () => { } })

    const closeAlert = () => setAlertConfig(prev => ({ ...prev, open: false }))

    async function executeAction(action: () => Promise<void>) {
        setLoading(true)
        try {
            await action()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
            closeAlert()
        }
    }

    // Cancel Match
    function confirmCancel() {
        setAlertConfig({
            open: true,
            title: "Cancel Match",
            description: "Are you sure you want to cancel this match? This action cannot be undone.",
            action: async () => {
                await cancelMatch(matchId)
                toast.success("Match cancelled")
            }
        })
    }

    // Update Match
    async function handleUpdate(status: string, winnerId: string | null) {
        setLoading(true)
        try {
            await updateMatchResult(matchId, winnerId, status)

            if (status === 'CONFIRMED' && winnerId) {
                toast.success("Match updated", {
                    description: "Do you want to calculate ELO ratings now?",
                    action: {
                        label: "Calculate ELO",
                        onClick: () => handleProcessElo(true) // Direct call without confirm
                    }
                })
            } else {
                toast.success("Match updated successfully")
            }
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    // Process ELO
    function confirmProcessElo() {
        setAlertConfig({
            open: true,
            title: "Calculate ELO",
            description: "Are you sure you want to calculate ELO ratings for this match? This will update player ratings.",
            action: async () => {
                await processMatchElo(matchId)
                toast.success("ELO processed successfully")
            }
        })
    }

    // Direct ELO call (from toast)
    async function handleProcessElo(skipConfirm = false) {
        if (!skipConfirm) {
            confirmProcessElo()
            return
        }

        setLoading(true)
        try {
            await processMatchElo(matchId)
            toast.success("ELO processed successfully")
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    function openScoreDialog() {
        if (currentScores && Array.isArray(currentScores)) {
            setScores(currentScores)
        } else {
            setScores([{ p1: '', p2: '' }])
        }
        setShowScoreDialog(true)
    }

    async function saveScores() {
        setLoading(true)
        try {
            const sanitizedScores = scores.filter(s => s.p1 !== '' || s.p2 !== '')
            await updateMatchResult(matchId, currentWinnerId, currentStatus, sanitizedScores)
            setShowScoreDialog(false)
            toast.success("Scores updated")
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>

                    <DropdownMenuItem onClick={openScoreDialog}>
                        Edit Scores
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Set Winner</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => handleUpdate('CONFIRMED', p1Id)}>
                                {p1Name || p1Id}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate('CONFIRMED', p2Id)}>
                                {p2Name || p2Id}
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Set Status</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => handleUpdate('PENDING', null)}>
                                Pending (Reset)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate('CONFIRMED', currentWinnerId)}>
                                Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate('PROCESSED', currentWinnerId)}>
                                Processed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate('DISPUTED', currentWinnerId)}>
                                Disputed
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {currentStatus === 'CONFIRMED' && (
                        <DropdownMenuItem onClick={() => handleProcessElo(false)}>
                            Process ELO
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={confirmCancel} className="text-red-600">
                        Cancel Match
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Match Scores</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <ScoreInput
                            key={showScoreDialog ? 'open' : 'closed'}
                            initialScores={scores}
                            config={scoringConfig}
                            player1Name={p1Name || 'Player 1'}
                            player2Name={p2Name || 'Player 2'}
                            onChange={setScores}
                        />
                        {/* Wait, check ScoreInput implementation */}
                        {/* It calls onChange(sets) in useEffect. */}
                        {/* It does NOT take initialSets. */}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowScoreDialog(false)}>Cancel</Button>
                        <Button onClick={saveScores} disabled={loading}>Save Scores</Button>
                    </DialogFooter>
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
        </>
    )
}
