'use plain'
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Filter, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'

type Sport = {
    id: string
    name: string
}

type Player = {
    id: string
    full_name: string
    sport_id: string
}

type Props = {
    sports: Sport[]
    players: Player[]
    initialSport: string
    initialStatus: string
    initialPlayer: string
}

export default function MatchFilters({ sports, players, initialSport, initialStatus, initialPlayer }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    function updateFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value && value !== 'all') {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        // reset to page 1 on filter change
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`)
    }

    // Filter players if a sport is selected
    const filteredPlayers = initialSport !== 'all'
        ? players.filter(p => p.sport_id === initialSport)
        : players

    // Deduplicate players if showing all (same user might have profiles for multiple sports)
    const uniquePlayers = initialSport !== 'all'
        ? filteredPlayers
        : Array.from(new Map(filteredPlayers.map(p => [p.full_name, p])).values())

    const activeFilterCount = [initialSport, initialStatus, initialPlayer].filter(v => v !== 'all').length

    const FilterContent = () => (
        <div className="flex flex-col md:flex-row gap-4">
            <div className="space-y-2 md:space-y-0">
                <span className="text-xs font-semibold text-muted-foreground md:hidden uppercase tracking-wider">Sport</span>
                <Select value={initialSport} onValueChange={(val) => updateFilter('sport', val)}>
                    <SelectTrigger className="w-full md:w-[180px] bg-background/50 backdrop-blur border-white/10">
                        <SelectValue placeholder="Filter by Sport" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sports</SelectItem>
                        {sports.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                                {s.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2 md:space-y-0">
                <span className="text-xs font-semibold text-muted-foreground md:hidden uppercase tracking-wider">Status</span>
                <Select value={initialStatus} onValueChange={(val) => updateFilter('status', val)}>
                    <SelectTrigger className="w-full md:w-[180px] bg-background/50 backdrop-blur border-white/10">
                        <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="CHALLENGED">Challenged</SelectItem>
                        <SelectItem value="PLAYED">Played</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                        <SelectItem value="FORFEIT">Forfeit</SelectItem>
                        <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2 md:space-y-0">
                <span className="text-xs font-semibold text-muted-foreground md:hidden uppercase tracking-wider">Player</span>
                <SearchableSelect
                    items={[
                        { label: "All Players", value: "all" },
                        ...uniquePlayers.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(p => ({
                            label: p.full_name,
                            value: p.id
                        }))
                    ]}
                    value={initialPlayer}
                    onValueChange={(val) => updateFilter('player', val)}
                    placeholder="Filter by Player"
                    className="w-full md:w-[200px] bg-background/50 backdrop-blur border-white/10"
                />
            </div>

            {(initialSport !== 'all' || initialStatus !== 'all' || initialPlayer !== 'all') && (
                <Button
                    variant="ghost"
                    onClick={() => router.push(pathname)}
                    className="text-muted-foreground hover:text-foreground md:ml-2"
                >
                    <X className="w-4 h-4 mr-2 md:hidden" />
                    Reset Filters
                </Button>
            )}
        </div>
    )

    return (
        <>
            {/* Desktop View */}
            <div className="hidden md:flex flex-wrap gap-4 items-center bg-card/30 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm">
                <FilterContent />
            </div>

            {/* Mobile View */}
            <div className="md:hidden w-full">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full flex justify-between bg-card/30 backdrop-blur border-white/10">
                            <span className="flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Filter Matches
                            </span>
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Filter Matches</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                            <FilterContent />
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Active Filter Chips for Mobile */}
                {activeFilterCount > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2 no-scrollbar">
                        {initialSport !== 'all' && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 whitespace-nowrap">
                                {sports.find(s => s.id === initialSport)?.name}
                            </Badge>
                        )}
                        {initialStatus !== 'all' && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 whitespace-nowrap">
                                {initialStatus}
                            </Badge>
                        )}
                        {initialPlayer !== 'all' && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 whitespace-nowrap">
                                {uniquePlayers.find(p => p.id === initialPlayer)?.full_name}
                            </Badge>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}
