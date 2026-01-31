import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCachedSports, getCachedAllPlayers } from '@/lib/cached-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type Props = {
  searchParams: { [key: string]: string | string[] | undefined }
}

const ITEMS_PER_PAGE = 20



export default async function MatchHistoryPage({ searchParams }: Props) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1
  const sportId = typeof resolvedSearchParams.sport === 'string' ? resolvedSearchParams.sport : 'all'
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : 'all'
  const playerId = typeof resolvedSearchParams.player === 'string' ? resolvedSearchParams.player : 'all'

  // Fetch cached data
  const [sports, allPlayers] = await Promise.all([
    getCachedSports(),
    getCachedAllPlayers()
  ])

  // Build query
  let query = supabase
    .from('matches')
    .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at, sports(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

  if (sportId !== 'all') {
    query = query.eq('sport_id', sportId)
  }
  if (status !== 'all') {
    query = query.eq('status', status)
  }
  if (playerId !== 'all') {
    query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
  }

  const { data, count } = await query

  const allMatches = ((data || []) as any[]).map((m) => ({
    ...m,
    sport_name: (m.sports && (m.sports as any).name) || null,
  }))

  // Create lookup map from cached players
  const profilesMap: Record<string, any> = {}
  allPlayers.forEach(p => {
    profilesMap[p.id] = p
  })

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Match History</h1>
        <Button variant="outline" asChild>
          <Link href="/rules">View Rules</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
            <CardTitle>Matches</CardTitle>
            <MatchFilters
              sports={sports}
              players={allPlayers as any[]}
              initialSport={sportId}
              initialStatus={status}
              initialPlayer={playerId}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Player 1</TableHead>
                  <TableHead>Player 2</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allMatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No matches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  allMatches.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString()}
                        <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </TableCell>
                      <TableCell>{m.sport_name}</TableCell>
                      <TableCell>{profilesMap[m.player1_id]?.full_name ?? 'Player 1'}</TableCell>
                      <TableCell>{profilesMap[m.player2_id]?.full_name ?? 'Player 2'}</TableCell>
                      <TableCell>
                        {m.winner_id ? (
                          <span className={m.winner_id === m.player1_id || m.winner_id === m.player2_id ? "text-emerald-600 font-medium" : ""}>
                            {profilesMap[m.winner_id]?.full_name ?? 'Unknown'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${m.status === 'CONFIRMED' || m.status === 'PROCESSED'
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : m.status === 'PENDING'
                            ? 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                            : 'bg-gray-50 text-gray-600 ring-gray-500/10'
                          }`}>
                          {m.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/matches/${m.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                asChild
              >
                <Link
                  href={{
                    pathname: '/match-history',
                    query: { ...resolvedSearchParams, page: page - 1 }
                  }}
                >
                  Previous
                </Link>
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                asChild
              >
                <Link
                  href={{
                    pathname: '/match-history',
                    query: { ...resolvedSearchParams, page: page + 1 }
                  }}
                >
                  Next
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
