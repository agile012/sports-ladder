'use client'

import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: userLoading } = useUser()
    const { getUserProfiles } = useLadders()
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const router = useRouter()

    useEffect(() => {
        if (userLoading) return
        if (!user) {
            router.push('/')
            return
        }

        async function check() {
            if (!user) return
            const profiles = await getUserProfiles(user.id)
            const hasAdmin = profiles.some(p => p.is_admin)
            if (hasAdmin) {
                setIsAdmin(true)
            } else {
                router.push('/')
            }
        }
        check()
    }, [user, userLoading, router, getUserProfiles])

    if (userLoading || isAdmin === null) {
        return <div className="p-8 text-center">Checking permissions...</div>
    }

    return <>{children}</>
}
