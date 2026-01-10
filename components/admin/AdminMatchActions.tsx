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
import { cancelMatch, updateMatchResult, processMatchElo } from '@/lib/actions/admin'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

type Props = {
    matchId: string
    currentStatus: string
    currentWinnerId: string | null
    p1Id: string
    p2Id: string
    p1Name?: string
    p2Name?: string
}

export default function AdminMatchActions({ matchId, currentStatus, currentWinnerId, p1Id, p2Id, p1Name, p2Name }: Props) {
    const [loading, setLoading] = useState(false)

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
            // If we just confirmed the match (and set a winner), ask to process ELO
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

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading}>
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>

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
    )
}
