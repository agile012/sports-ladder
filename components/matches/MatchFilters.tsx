'use plain'
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'

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

    function updateFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value && value !== 'all') {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        // reset to page 1 on filter change
        params.delete('page')
        router.push(`/match-history?${params.toString()}`)
    }

    // Filter players if a sport is selected
    const filteredPlayers = initialSport !== 'all'
        ? players.filter(p => p.sport_id === initialSport)
        : players

    // Deduplicate players if showing all (same user might have profiles for multiple sports)
    const uniquePlayers = initialSport !== 'all'
        ? filteredPlayers
        : Array.from(new Map(filteredPlayers.map(p => [p.full_name, p])).values()) // naive dedupe by name for simpler UI when no sport selected

    return (
        <div className="flex flex-wrap gap-4 items-center">
            <Select value={initialSport} onValueChange={(val) => updateFilter('sport', val)}>
                <SelectTrigger className="w-[180px]">
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

            <Select value={initialStatus} onValueChange={(val) => updateFilter('status', val)}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="PROCESSED">Processed</SelectItem>
                    <SelectItem value="CHALLENGED">Challenged</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
            </Select>

            <SearchableSelect
                items={[
                    { label: "All Players", value: "all" },
                    ...uniquePlayers.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(p => ({
                        label: p.full_name,
                        value: initialSport !== 'all' ? p.id : p.id
                    }))
                ]}
                value={initialPlayer}
                onValueChange={(val) => updateFilter('player', val)}
                placeholder="Filter by Player"
                className="w-[180px]"
            />

            {(initialSport !== 'all' || initialStatus !== 'all' || initialPlayer !== 'all') && (
                <Button
                    variant="ghost"
                    onClick={() => router.push('/match-history')}
                >
                    Reset
                </Button>
            )}
        </div>
    )
}
