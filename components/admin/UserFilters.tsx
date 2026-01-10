'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { Button } from '@/components/ui/button'

type Props = {
    sports: { id: string, name: string }[]
    initialSport: string
    initialSearch: string
}

export default function UserFilters({ sports, initialSport, initialSearch }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const [search, setSearch] = useState(initialSearch)
    const [debouncedSearch] = useDebounce(search, 500)
    const [sportId, setSportId] = useState(initialSport)

    function updateFilters(newSport: string, newSearch: string) {
        const params = new URLSearchParams()
        if (newSport && newSport !== 'all') params.set('sport', newSport)
        if (newSearch) params.set('q', newSearch)

        // Reset page on filter change
        params.set('page', '1')

        router.push(`${pathname}?${params.toString()}`)
    }

    useEffect(() => {

        if (debouncedSearch !== initialSearch) {
            updateFilters(sportId, debouncedSearch)
        }
    }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSportChange = (val: string) => {
        setSportId(val)
        updateFilters(val, search)
    }

    const handleReset = () => {
        setSearch('')
        setSportId('all')
        router.push(pathname)
    }

    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Input
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
            />

            <Select value={sportId} onValueChange={handleSportChange}>
                <SelectTrigger className="w-full sm:w-[200px]">
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

            <Button variant="ghost" onClick={handleReset}>
                Reset
            </Button>
        </div>
    )
}
