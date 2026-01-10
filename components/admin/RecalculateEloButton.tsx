'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { recalculateElo } from '@/lib/actions/admin'
import { Loader2 } from 'lucide-react'

export default function RecalculateEloButton() {
    const [isPending, startTransition] = useTransition()

    function handleClick() {
        if (!confirm('Are you sure you want to recalculate ELO for ALL matches? This may take several minutes.')) {
            return
        }

        startTransition(async () => {
            try {
                await recalculateElo()
                alert('Recalculation started/completed successfully.')
            } catch (error: any) {
                alert('Error: ' + error.message)
            }
        })
    }

    return (
        <Button
            variant="destructive"
            onClick={handleClick}
            disabled={isPending}
            className="min-w-[170px]"
        >
            {isPending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : (
                'Recalculate All ELO'
            )}
        </Button>
    )
}
