'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { Button } from '@/components/ui/button'

type Props = {
    sports: { id: string, name: string }[]
    cohorts?: { id: string, name: string }[]
    initialSport: string
    initialSearch: string
    initialCohort?: string
}

export default function UserFilters({ sports, cohorts = [], initialSport, initialSearch, initialCohort = 'all' }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const [search, setSearch] = useState(initialSearch)
    const [debouncedSearch] = useDebounce(search, 500)
    const [sportId, setSportId] = useState(initialSport)
    const [cohortId, setCohortId] = useState(initialCohort)

    function updateFilters(newSport: string, newSearch: string, newCohort: string) {
        const params = new URLSearchParams()
        if (newSport && newSport !== 'all') params.set('sport', newSport)
        if (newSearch) params.set('q', newSearch)
        if (newCohort && newCohort !== 'all') params.set('cohort', newCohort)

        // Reset page on filter change
        params.set('page', '1')

        router.push(`${pathname}?${params.toString()}`)
    }

    useEffect(() => {

        if (debouncedSearch !== initialSearch) {
            updateFilters(sportId, debouncedSearch, cohortId)
        }
    }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSportChange = (val: string) => {
        setSportId(val)
        updateFilters(val, search, cohortId)
    }

    const handleCohortChange = (val: string) => {
        setCohortId(val)
        updateFilters(sportId, search, val)
    }

    const handleReset = () => {
        setSearch('')
        setSportId('all')
        setCohortId('all')
        router.push(pathname)
    }

    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center flex-wrap">
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

            {cohorts.length > 0 && (
                <Select value={cohortId} onValueChange={handleCohortChange}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by Cohort" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Cohorts</SelectItem>
                        {cohorts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            <Button variant="ghost" onClick={handleReset}>
                Reset
            </Button>
        </div>
    )
}
