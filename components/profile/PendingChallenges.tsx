
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PendingChallengeItem } from '@/lib/types'
import { Swords, Check, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusMap: Record<string, string> = {
  PENDING: 'Pending Result',
  CHALLENGED: 'Challenged',
  PROCESSING: 'Reviewing Result',
}

const getMatchStatus = (match: PendingChallengeItem) => {
  if (match.result === 'win') return 'Won'
  if (match.result === 'loss') return 'Lost'
  return statusMap[match.status] || match.status
}

const getBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" => {
  switch (status) {
    case 'Won': return 'success' as any // Custom variant handling or map to default
    case 'Lost': return 'destructive'
    case 'Challenged': return 'default'
    case 'Pending Result': return 'secondary'
    default: return 'outline'
  }
}

export default function PendingChallenges({
  challenges,
  currentUserIds,
  onAction = () => window.location.reload(),
  isReadOnly = false,
}: {
  challenges: PendingChallengeItem[] | undefined
  currentUserIds: string[]
  onAction?: () => void
  isReadOnly?: boolean
}) {
  if (!challenges || challenges.length === 0) return null

  return (
    <Card className="border-l-4 border-l-primary shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Pending Challenges</CardTitle>
        </div>
        <CardDescription>Action required for these matches</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {challenges.map((c) => {
          const status = getMatchStatus(c)
          const myProfileId = currentUserIds.find(id => id === c.player1?.id || id === c.player2?.id)
          const badgeVariant = getBadgeVariant(status)

          return (
            <div key={c.id} className="group relative overflow-hidden rounded-lg border bg-background p-4 transition-all hover:shadow-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                {/* Match Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={badgeVariant as any} className={cn(
                      "font-semibold",
                      status === 'Challenged' && "bg-blue-500 hover:bg-blue-600",
                      status === 'Won' && "bg-emerald-500 hover:bg-emerald-600",
                    )}>
                      {status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="font-semibold text-base flex flex-wrap gap-2 items-center">
                    <span>{c.player1.full_name}</span>
                    <span className="text-muted-foreground text-xs uppercase font-bold">vs</span>
                    <span>{c.player2.full_name}</span>
                  </div>
                  {c.message && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
                      <AlertCircle className="h-3 w-3" />
                      "{c.message}"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {!isReadOnly && c.status === 'CHALLENGED' && c.player2?.id === myProfileId && (
                    <>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() =>
                          window.fetch(`/api/matches/${c.id}/action?action=accept&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                        }
                      >
                        <Check className="mr-1 h-3 w-3" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className='bg-red-500 hover:bg-red-600'
                        onClick={() =>
                          window.fetch(`/api/matches/${c.id}/action?action=reject&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                        }
                      >
                        <X className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </>
                  )}

                  {!isReadOnly && c.status === 'PENDING' && (
                    <form
                      className="flex items-center gap-2 bg-muted/50 p-1 rounded-md"
                      onSubmit={async e => {
                        e.preventDefault()
                        const form = e.target as HTMLFormElement
                        const data = new FormData(form)
                        const winner = data.get('winner') as string
                        await fetch(`/api/matches/${c.id}/submit-result`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ winner_profile_id: winner, reported_by: myProfileId, token: c.action_token }),
                        })
                        onAction()
                      }}
                    >
                      <Select name="winner">
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue placeholder="Who won?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={c.player1.id}>{c.player1.full_name ?? 'Player 1'}</SelectItem>
                          <SelectItem value={c.player2.id}>{c.player2.full_name ?? 'Player 2'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" type="submit" className="h-8 text-xs">
                        Report
                      </Button>
                    </form>
                  )}

                  {!isReadOnly && c.status === 'PROCESSING' &&
                    (c.reported_by?.id !== myProfileId ? (
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-2 py-1 rounded text-xs font-bold",
                          c.winner_id === myProfileId ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {c.winner_id === myProfileId ? 'They say you Won' : 'They say you Lost'}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                          onClick={() =>
                            window.fetch(`/api/matches/${c.id}/verify?verify=yes&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                          }
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-red-500 text-red-600 hover:bg-red-50"
                          onClick={() =>
                            window.fetch(`/api/matches/${c.id}/verify?verify=no&token=${c.action_token}`, { method: 'POST' }).then(() => onAction())
                          }
                        >
                          Dispute
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <LoaderIcon className="h-3 w-3 animate-spin" />
                        Waiting for opponent
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function LoaderIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
