'use client'

import { Button } from '@/components/ui/button'
import { toggleAdmin, deactivatePlayer } from '@/lib/actions/admin'
import { useTransition } from 'react'
import { Ban, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AdminUserActions({ profileId, isAdmin, sportId }: { profileId: string, isAdmin: boolean, sportId: string }) {
    const [isPending, startTransition] = useTransition()

    function handleToggle() {
        startTransition(async () => {
            await toggleAdmin(profileId, !isAdmin)
        })
    }

    function handleDeactivate() {
        if (!confirm('Are you sure you want to FORCE deactivate this player from the ladder? They will lose their rank.')) return

        startTransition(async () => {
            try {
                await deactivatePlayer(sportId, profileId)
                toast.success('Player deactivated')
            } catch (e: any) {
                toast.error(e.message)
            }
        })
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleToggle} disabled={isPending}>
                    {isAdmin ? 'Remove Admin' : 'Make Admin'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDeactivate} disabled={isPending} className="text-red-600 focus:text-red-600">
                    <Ban className="mr-2 h-4 w-4" />
                    Deactivate Player
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
