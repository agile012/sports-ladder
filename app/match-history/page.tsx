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
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Trophy, ArrowRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
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
    .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at, scores, sports(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

  if (sportId !== 'all') {
    query = query.eq('sport_id', sportId)
  }
  if (status !== 'all') {
    switch (status) {
      case 'WITHDRAWN':
        query = query.eq('status', 'CANCELLED')
        break
      case 'FORFEIT':
        query = query.eq('status', 'PROCESSED').eq('scores->>reason', 'forfeit')
        break
      case 'DONE':
        query = query.eq('status', 'PROCESSED').or('scores.is.null,scores->>reason.neq.forfeit')
        break
      case 'PLAYED':
        query = query.eq('status', 'PROCESSING')
        break
      case 'CHALLENGED':
        query = query.in('status', ['CHALLENGED', 'PENDING'])
        break
      default:
        // Fallback for direct DB statuses if ever passed manually
        query = query.eq('status', status)
    }
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

  const getStatusDisplay = (match: any) => {
    const status = match.status;
    const scores = match.scores as any;

    if (status === 'CANCELLED') return { label: 'Withdrawn', variant: 'secondary' as const, className: 'bg-muted text-muted-foreground' };
    if (status === 'PROCESSED') {
      if (scores?.reason === 'forfeit') return { label: 'Forfeit', variant: 'destructive' as const };
      return { label: 'Done', variant: 'default' as const, className: 'bg-emerald-600 hover:bg-emerald-700' };
    }
    if (status === 'CHALLENGED') return { label: 'Challenged', variant: 'outline' as const, className: 'text-blue-600 border-blue-200 bg-blue-50' };
    if (status === 'PENDING') return { label: 'Pending', variant: 'secondary' as const, className: 'bg-amber-100 text-amber-700' };
    if (status === 'PROCESSING') return { label: 'Played', variant: 'secondary' as const, className: 'bg-purple-100 text-purple-700' };

    return { label: status, variant: 'outline' as const };
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Match History</h1>
          <p className="text-muted-foreground">Recent battles and results</p>
        </div>
        <Button variant="outline" asChild className="hidden md:flex">
          <Link href="/rules">View Rules</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card/50 backdrop-blur-sm border rounded-xl p-4 shadow-sm">
        <MatchFilters
          sports={sports}
          players={allPlayers as any[]}
          initialSport={sportId}
          initialStatus={status}
          initialPlayer={playerId}
        />
      </div>

      <div className="space-y-4">
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Matchup</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allMatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No matches found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                allMatches.map((m) => {
                  const p1 = profilesMap[m.player1_id]
                  const p2 = profilesMap[m.player2_id]
                  const statusInfo = getStatusDisplay(m)

                  return (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{new Date(m.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">{m.sport_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", m.winner_id === m.player1_id && "text-emerald-600")}>{p1?.full_name ?? 'Player 1'}</span>
                          <span className="text-muted-foreground text-xs">vs</span>
                          <span className={cn("font-medium", m.winner_id === m.player2_id && "text-emerald-600")}>{p2?.full_name ?? 'Player 2'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.winner_id ? (
                          <div className="flex items-center gap-2">
                            <Trophy className="h-3 w-3 text-emerald-500" />
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              {profilesMap[m.winner_id]?.full_name ?? 'Unknown'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className={statusInfo.className}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild className="hover:bg-primary/5">
                          <Link href={`/matches/${m.id}`}>View Details</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {allMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              No matches found.
            </div>
          ) : (
            allMatches.map(m => {
              const p1 = profilesMap[m.player1_id]
              const p2 = profilesMap[m.player2_id]
              const statusInfo = getStatusDisplay(m)

              return (
                <Link href={`/matches/${m.id}`} key={m.id} className="block">
                  <Card className="hover:shadow-md transition-shadow active:scale-[0.99] border-l-4" style={{
                    borderLeftColor: m.status === 'PROCESSED' ? '#10b981' :
                      m.status === 'CHALLENGED' ? '#3b82f6' :
                        m.status === 'PENDING' ? '#f59e0b' : '#e5e7eb'
                  }}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground uppercase">{m.sport_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge variant={statusInfo.variant} className={cn("text-[10px] uppercase", statusInfo.className)}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Avatar className="h-8 w-8 border">
                            <AvatarImage src={p1?.avatar_url} />
                            <AvatarFallback>{p1?.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className={cn("text-sm font-semibold truncate", m.winner_id === p1?.id && "text-emerald-600")}>
                              {p1?.full_name}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs font-black text-muted-foreground/30 italic">VS</div>

                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                          <div className="flex flex-col min-w-0">
                            <span className={cn("text-sm font-semibold truncate", m.winner_id === p2?.id && "text-emerald-600")}>
                              {p2?.full_name}
                            </span>
                          </div>
                          <Avatar className="h-8 w-8 border">
                            <AvatarImage src={p2?.avatar_url} />
                            <AvatarFallback>{p2?.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        </div>
                      </div>

                      {m.winner_id && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded w-fit">
                          <Trophy className="h-3 w-3" />
                          <span className="font-bold">Winner:</span>
                          <span>{profilesMap[m.winner_id]?.full_name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
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
            <div className="text-sm text-muted-foreground font-medium">
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
      </div>
    </div>
  )
}
