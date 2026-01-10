import { createClient } from '@/lib/supabase/server'
import MatchFilters from '@/components/matches/MatchFilters'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button'
import { cancelMatch, recalculateElo, updateMatchResult } from '@/lib/actions/admin'
import Link from 'next/link'
import AdminMatchActions from '@/components/admin/AdminMatchActions'

import RecalculateEloButton from '@/components/admin/RecalculateEloButton'
import CreateMatchButton from '@/components/admin/CreateMatchButton'

type Props = {
    searchParams: { [key: string]: string | string[] | undefined }
}

const ITEMS_PER_PAGE = 20

export default async function AdminMatchesPage({ searchParams }: Props) {
    const supabase = await createClient()
    const resolvedSearchParams = await searchParams
    const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1
    const sportId = typeof resolvedSearchParams.sport === 'string' ? resolvedSearchParams.sport : 'all'
    const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : 'all'
    const playerId = typeof resolvedSearchParams.player === 'string' ? resolvedSearchParams.player : 'all'

    // Get current user and their admin sports
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <div>Unauthorized</div>

    const { data: adminProfiles } = await supabase
        .from('player_profiles')
        .select('sport_id')
        .eq('user_id', user.id)
        .eq('is_admin', true)

    const adminSportIds = adminProfiles?.map(p => p.sport_id) || []

    // Fetch data (only sports they are admin of)
    const { data: sportsData } = await supabase
        .from('sports')
        .select('id, name')
        .in('id', adminSportIds)
    const sports = sportsData || []

    const { data: playersData } = await supabase.from('player_profiles_view').select('id, full_name, sport_id')
    const players = playersData || []

    let query = supabase
        .from('matches')
        .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at, sports(id, name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

    // Force filter by admin sports
    if (sportId !== 'all') {
        // Ensure they are admin of the requested sport
        if (adminSportIds.includes(sportId as string)) {
            query = query.eq('sport_id', sportId)
        } else {
            // If they ask for a sport they aren't admin of, show nothing or default to their allowed list
            query = query.in('sport_id', [])
        }
    } else {
        query = query.in('sport_id', adminSportIds)
    }

    if (status !== 'all') query = query.eq('status', status)
    if (playerId !== 'all') query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)

    const { data, count } = await query

    const allMatches = ((data || []) as any[]).map((m) => ({
        ...m,
        sport_name: (m.sports && (m.sports as any).name) || null,
    }))

    const ids = Array.from(new Set(allMatches.flatMap((m) => [m.player1_id, m.player2_id, m.winner_id].filter(Boolean)))) as string[]
    const profilesMap: Record<string, any> = {}
    if (ids.length) {
        const { data: profiles } = await supabase.from('player_profiles_view').select('id, full_name').in('id', ids)
            ; (profiles || []).forEach((p: any) => { profilesMap[p.id] = p })
    }

    const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Manage Matches</h1>
                <div className="flex gap-2">
                    <CreateMatchButton sports={sports} players={players as any[]} currentSportId={sportId} />
                    <RecalculateEloButton />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <MatchFilters
                    sports={sports}
                    players={players as any[]}
                    initialSport={sportId}
                    initialStatus={status}
                    initialPlayer={playerId}
                />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Sport</TableHead>
                            <TableHead>Players</TableHead>
                            <TableHead>Winner</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allMatches.map((m) => (
                            <TableRow key={m.id}>
                                <TableCell className="whitespace-nowrap">
                                    {new Date(m.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{m.sport_name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <span>
                                            <Link href={`/player/${m.player1_id}`} className="hover:underline text-blue-600">
                                                {profilesMap[m.player1_id]?.full_name ?? 'P1'}
                                            </Link>
                                        </span>
                                        <span className="text-xs text-muted-foreground">vs</span>
                                        <span>
                                            <Link href={`/player/${m.player2_id}`} className="hover:underline text-blue-600">
                                                {profilesMap[m.player2_id]?.full_name ?? 'P2'}
                                            </Link>
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {m.winner_id ? profilesMap[m.winner_id]?.full_name : '-'}
                                </TableCell>
                                <TableCell>{m.status}</TableCell>
                                <TableCell className="text-right">
                                    <AdminMatchActions
                                        matchId={m.id}
                                        currentStatus={m.status}
                                        currentWinnerId={m.winner_id}
                                        p1Id={m.player1_id}
                                        p2Id={m.player2_id}
                                        p1Name={profilesMap[m.player1_id]?.full_name}
                                        p2Name={profilesMap[m.player2_id]?.full_name}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination (Simplified) */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    {/* Reuse logic or component if time permits, for now simple links */}
                    <Button variant="outline" size="sm" disabled={page <= 1} asChild>
                        <Link href={`/admin/matches?page=${page - 1}`}>Previous</Link>
                    </Button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} asChild>
                        <Link href={`/admin/matches?page=${page + 1}`}>Next</Link>
                    </Button>
                </div>
            )}
        </div>
    )
}
