'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, BookOpen, ChevronDown, Check } from 'lucide-react'
import { Sport } from '@/lib/types'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface LadderHeaderProps {
    selectedSport: Sport | null
    user: any
    sortBy: 'ladder' | 'rating'
    setSortBy: (v: 'ladder' | 'rating') => void
    onBack?: () => void
    children?: React.ReactNode
}

export default function LadderHeader({
    selectedSport,
    user,
    sortBy,
    setSortBy,
    onBack,
    children
}: LadderHeaderProps) {

    if (!selectedSport) return null

    return (
        <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
                {onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-black tracking-tight">
                        {selectedSport.name} Ladder
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {sortBy === 'ladder' ? 'Sorted by Ladder Position' : 'Sorted by Elo Rating'}
                    </p>
                </div>

                <div className="flex gap-2 items-center flex-shrink-0">
                    {children}

                    {/* Sort Dropdown — clear label */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-3">
                                <span className="text-xs font-semibold">
                                    {sortBy === 'ladder' ? 'Rank' : 'Rating'}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSortBy('ladder')} className="gap-2">
                                {sortBy === 'ladder' && <Check className="h-3 w-3" />}
                                <span className={sortBy !== 'ladder' ? 'pl-5' : ''}>Sort by Rank</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('rating')} className="gap-2">
                                {sortBy === 'rating' && <Check className="h-3 w-3" />}
                                <span className={sortBy !== 'rating' ? 'pl-5' : ''}>Sort by Rating</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Analytics — labeled */}
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-3" asChild>
                        <Link href={`/analytics/${selectedSport.id}`}>
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold hidden sm:inline">Stats</span>
                        </Link>
                    </Button>

                    {/* Rules — labeled */}
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-3" asChild>
                        <Link href="/rules">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold hidden sm:inline">Rules</span>
                        </Link>
                    </Button>
                </div>
            </div>

            {!user && (
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <div className="text-sm">Sign in to join the competition</div>
                        <Button size="sm" asChild>
                            <Link href="/login">Sign In</Link>
                        </Button>
                    </CardHeader>
                </Card>
            )}
        </div>
    )
}
