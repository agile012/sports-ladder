'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function BackButton() {
    const router = useRouter()

    return (
        <Button onClick={() => router.back()} variant="ghost" className="pl-0 hover:bg-transparent hover:underline">
            ← Back
        </Button>
    )
}
