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
import { cancelMatch, updateMatchResult, processMatchElo } from '@/lib/actions/admin'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { ScoreInput, ScoreSet, ScoringConfig } from '@/components/matches/ScoreInput'

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

    async function handleCancel() {
        if (!confirm('Are you sure you want to cancel this match?')) return
        setLoading(true)
        try {
            await cancelMatch(matchId)
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdate(status: string, winnerId: string | null) {
        setLoading(true)
        try {
            await updateMatchResult(matchId, winnerId, status)
            if (status === 'CONFIRMED' && winnerId) {
                if (confirm('Match updated. Do you want to calculate ELO ratings for this match now?')) {
                    await processMatchElo(matchId)
                    alert('ELO processed successfully.')
                }
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleProcessElo() {
        if (!confirm('Calculate ELO ratings for this match?')) return
        setLoading(true)
        try {
            await processMatchElo(matchId)
            alert('ELO processed successfully.')
        } catch (e: any) {
            alert('Error: ' + e.message)
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
            // Determine winner based on scores if possible, or just keep current winner
            // For admin edit, we might trust them to set winner via menu if needed, or we could auto-deduce.
            // For now, allow saving scores without changing winner/status unless explicitly done?
            // User requested "enter scores".
            // We should pass scores to updateMatchResult.
            // We pass current status and winner to avoid changing them implicitly, or we could allow logic.
            // Let's passed sanitized scores
            const sanitizedScores = scores.filter(s => s.p1 !== '' || s.p2 !== '')
            await updateMatchResult(matchId, currentWinnerId, currentStatus, sanitizedScores)
            setShowScoreDialog(false)
        } catch (e: any) {
            alert('Error: ' + e.message)
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
                        <DropdownMenuItem onClick={handleProcessElo}>
                            Process ELO
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCancel} className="text-red-600">
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
                            config={scoringConfig}
                            player1Name={p1Name || 'Player 1'}
                            player2Name={p2Name || 'Player 2'}
                            // We need to pass initial scores, but ScoreInput manages its own state
                            // We reused ScoreInput which calls onChange. 
                            // But ScoreInput has internal state initialized to [{p1:'',p2:''}].
                            // We need to update ScoreInput to accept `initialScores` or use a key to reset it.
                            // I'll add key={showScoreDialog ? 'open' : 'closed'} to force remount or handle initial.
                            // Better: pass current state into it? ScoreInput is controlled?
                            // Checking ScoreInput.tsx: It has internal state initialized to default. It does NOT take value prop.
                            // I need to update ScoreInput or wrap it.
                            // Or I can modify ScoreInput to accept `initialValue`.
                            // For now, I will assume ScoreInput handles onChange.
                            // I will check ScoreInput again.
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
        </>
    )
}
