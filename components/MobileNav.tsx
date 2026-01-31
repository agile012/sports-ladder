'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Trophy, User, TrendingUp, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function MobileNav() {
    const pathname = usePathname()
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.user_metadata?.avatar_url) {
                setAvatarUrl(user.user_metadata.avatar_url)
            }
        }
        getUser()
    }, [])

    const navItems = [
        { href: '/', label: 'Home', icon: Home },
        { href: '/ladder', label: 'Ladder', icon: Trophy },
        { href: '/match-history', label: 'Matches', icon: History },
        { href: '/analytics', label: 'Analytics', icon: TrendingUp },
        { href: '/profile', label: 'Profile', icon: User, isProfile: true }, // Mark profile
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe-area-inset-bottom">
            <div className="glass-light dark:glass-dark border-t backdrop-blur-xl bg-background/80 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around items-center h-16 px-2">
                    {navItems.map(({ href, label, icon: Icon, isProfile }) => {
                        const isActive = pathname === href
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300",
                                    isActive
                                        ? "text-primary scale-105"
                                        : "text-muted-foreground hover:text-foreground active:scale-95"
                                )}
                            >
                                <div className={cn(
                                    "p-1.5 rounded-full transition-all",
                                    isActive && "bg-primary/10 ring-1 ring-primary/20"
                                )}>
                                    {isProfile && avatarUrl ? (
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={avatarUrl} alt="Profile" />
                                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <Icon className={cn("h-5 w-5", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                                    )}
                                </div>
                                <span className="text-[10px] font-medium tracking-wide">{label}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
