'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Trophy, User, TrendingUp, History, LogOut, Sun, Moon, Laptop, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useLongPress } from '@/hooks/useLongPress'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { toast } from 'sonner'
import { getCachedSports } from '@/lib/cached-data'

export default function MobileNav() {
    const pathname = usePathname()
    const router = useRouter()
    const { theme, setTheme } = useTheme()
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [sports, setSports] = useState<{ id: string, name: string }[]>([])

    // Dropdown States
    const [menuOpen, setMenuOpen] = useState<string | null>(null)

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

        // Fetch sports for shortcuts
        const fetchSports = async () => {
            const { data } = await supabase.from('sports').select('id, name').order('name');
            if (data) setSports(data)
        }
        fetchSports()

    }, [])

    const handleSignOut = async () => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        await supabase.auth.signOut()
        toast.success('Signed out')
        router.push('/login')
    }

    const navItems = [
        { href: '/', label: 'Home', icon: Home, id: 'home' },
        { href: '/ladder', label: 'Ladder', icon: Trophy, id: 'ladder', hasMenu: true },
        { href: '/match-history', label: 'Matches', icon: History, id: 'matches' },
        { href: '/analytics', label: 'Analytics', icon: TrendingUp, id: 'analytics', hasMenu: true },
        { href: '/profile', label: 'Profile', icon: User, isProfile: true, id: 'profile', hasMenu: true },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe-area-inset-bottom">
            <div className="glass-light dark:glass-dark border-t backdrop-blur-xl bg-background/80 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around items-center h-16 px-2">
                    {navItems.map((item) => {
                        const { href, label, icon: Icon, isProfile, hasMenu, id } = item
                        const isActive = pathname === href

                        // Long Press Hook
                        const longPressProps = useLongPress({
                            onLongPress: () => {
                                if (hasMenu) {
                                    // Trigger vibration if available
                                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                        navigator.vibrate(100);
                                    }
                                    setMenuOpen(id)
                                }
                            },
                            onClick: () => {
                                router.push(href)
                            }
                        })

                        // We wrap the item in a dropdown trigger if it has actions
                        // But we control open state manually via long press
                        return (
                            <DropdownMenu key={id} open={menuOpen === id} onOpenChange={(open) => !open && setMenuOpen(null)}>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        {...longPressProps}
                                        className={cn(
                                            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 cursor-pointer select-none",
                                            isActive
                                                ? "text-primary scale-105"
                                                : "text-muted-foreground hover:text-foreground active:scale-95"
                                        )}
                                        // Prevent default context menu on list press
                                        onContextMenu={(e) => e.preventDefault()}
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
                                    </div>
                                </DropdownMenuTrigger>

                                {hasMenu && (
                                    <DropdownMenuContent align="center" className="w-56 mb-2">
                                        {id === 'ladder' && (
                                            <>
                                                <DropdownMenuLabel>Jump to Ladder</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {sports.slice(0, 5).map(s => (
                                                    <DropdownMenuItem key={s.id} onClick={() => router.push(`/ladder?sport=${s.id}`)}>
                                                        <Trophy className="mr-2 h-4 w-4" />
                                                        <span>{s.name}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                                {sports.length > 5 && <DropdownMenuItem disabled>More...</DropdownMenuItem>}
                                            </>
                                        )}

                                        {id === 'analytics' && (
                                            <>
                                                <DropdownMenuLabel>View Analytics</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {sports.slice(0, 5).map(s => (
                                                    <DropdownMenuItem key={s.id} onClick={() => router.push(`/analytics?sport=${s.id}`)}>
                                                        <TrendingUp className="mr-2 h-4 w-4" />
                                                        <span>{s.name}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                            </>
                                        )}

                                        {id === 'profile' && (
                                            <>
                                                <DropdownMenuLabel>Profile Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setTheme('light')}>
                                                    <Sun className="mr-2 h-4 w-4" /> Light Mode
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setTheme('dark')}>
                                                    <Moon className="mr-2 h-4 w-4" /> Dark Mode
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setTheme('system')}>
                                                    <Laptop className="mr-2 h-4 w-4" /> System Theme
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-500" onClick={handleSignOut}>
                                                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                )}
                            </DropdownMenu>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
