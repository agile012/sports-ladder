
'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MatchHistoryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'
import Link from 'next/link'

const statusMap: Record<string, string> = {
  PENDING: 'Pending',
  CHALLENGED: 'Challenged',
}

const getMatchStatus = (match: MatchHistoryItem) => {
  if (match.result === 'win') return 'Won'
  if (match.result === 'loss') return 'Lost'
  return statusMap[match.status] || match.status
}

export default function MatchHistory({ matches }: { matches: MatchHistoryItem[] | undefined }) {
  return (
    <div className="bg-muted/10 rounded-xl p-4 h-full border border-border/50">
      <h4 className="flex items-center gap-2 font-semibold mb-4 text-xs uppercase tracking-wider text-muted-foreground">
        <Calendar className="h-3 w-3" />
        match history
      </h4>
      {matches && matches.length > 0 ? (
        <div className="flex flex-col gap-2">
          {matches.map((m) => {
            const status = getMatchStatus(m)
            return (
              <Link key={m.id} href={`/matches/${m.id}`} className="block">
                <div className="flex items-center justify-between text-sm bg-background p-2.5 rounded-lg border shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8 ring-1 ring-border/50 shrink-0">
                      <AvatarImage src={m.opponent?.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-muted font-bold">{(m.opponent?.full_name ?? '').toString()[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate pr-2">{m.opponent?.full_name ?? 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-semibold border-0 px-2 py-0.5 text-[10px]",
                        status === 'Won' && "bg-green-500/10 text-green-700 dark:text-green-400",
                        status === 'Lost' && "bg-red-500/10 text-red-700 dark:text-red-400",
                        status === 'Pending' && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                      )}
                    >
                      {status}
                    </Badge>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/20">
          No matches
        </div>
      )}
    </div>
  )
}
