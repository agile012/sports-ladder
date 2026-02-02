'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, UserPlus, ArrowUpDown, TrendingUp, BookOpen } from 'lucide-react'
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
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        {selectedSport.name} Ladder
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {sortBy === 'ladder' ? 'Ranked by Position' : 'Ranked by Elo Rating'}
                    </p>
                </div>

                <div className="ml-auto flex gap-2 items-center">
                    {children}
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" asChild>
                        <Link href={`/analytics/${selectedSport.id}`}>
                            <TrendingUp className="h-4 w-4" />
                        </Link>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSortBy('ladder')}>
                                Sort by Rank {sortBy === 'ladder' && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('rating')}>
                                Sort by Rating {sortBy === 'rating' && '✓'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" asChild title="View Rules">
                        <Link href="/rules"><BookOpen className="h-4 w-4" /></Link>
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
