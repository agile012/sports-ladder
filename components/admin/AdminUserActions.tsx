'use client'

import { Button } from '@/components/ui/button'
import { toggleAdmin } from '@/lib/actions/admin'
import { useTransition } from 'react'

export default function AdminUserActions({ profileId, isAdmin }: { profileId: string, isAdmin: boolean }) {
    const [isPending, startTransition] = useTransition()

    function handleToggle() {
        startTransition(async () => {
            await toggleAdmin(profileId, !isAdmin)
        })
    }

    return (
        <Button
            variant={isAdmin ? "destructive" : "outline"}
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
            className={isPending ? 'opacity-50' : ''}
        >
            {isAdmin ? 'Remove Admin' : 'Make Admin'}
        </Button>
    )
}
