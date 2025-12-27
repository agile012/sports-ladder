
'use client'

import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Badge } from '@/app/components/ui/badge'

const statusMap: Record<string, string> = {
  PENDING: 'Pending',
  CHALLENGED: 'Challenged',
  PROCESSING: 'Processing',
}

const getMatchStatus = (match: any) => {
  if (match.result === 'win') return 'Won'
  if (match.result === 'loss') return 'Lost'
  return statusMap[match.status] || match.status
}

const getBadgeVariant = (status: string) => {
  switch (status) {
    case 'Won':
      return 'default'
    case 'Lost':
      return 'destructive'
    case 'Challenged':
      return 'default'
    default:
      return 'secondary'
  }
}

export default function PendingChallenges({
  challenges,
  profile,
  onAction = () => window.location.reload(),
}: {
  challenges: any[]
  profile: any
  onAction?: () => void
}) {
  if (!challenges || challenges.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Challenges</CardTitle>
        <CardDescription>Challenges that require your attention.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenges.map((c: any) => {
          const status = getMatchStatus(c)
          console.log('c.winner_id', c.winner_id, 'profile.id', profile.id)

          return (
            <div key={c.id} className="border rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="font-semibold">
                  <Badge variant={getBadgeVariant(status)} className={status === 'Challenged' ? 'bg-blue-500' : ''}>
                    {status}
                  </Badge>{' '}
                  • {c.player1_id.full_name} vs {c.player2_id.full_name}
                </div>
                <p className="text-sm text-muted-foreground">{c.message ?? ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'CHALLENGED' && c.player2_id?.id === profile.id && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        window.fetch(`/api/matches/${c.id}/action?action=accept&token=${c.action_token}`).then(() => onAction())
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        window.fetch(`/api/matches/${c.id}/action?action=reject&token=${c.action_token}`).then(() => onAction())
                      }
                    >
                      Reject
                    </Button>
                  </>
                )}

                {c.status === 'PENDING' && (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={async e => {
                      e.preventDefault()
                      const form = e.target as HTMLFormElement
                      const data = new FormData(form)
                      const winner = data.get('winner') as string
                      await fetch(`/api/matches/${c.id}/submit-result`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ winner_profile_id: winner, reported_by: profile.id, token: c.action_token }),
                      })
                      onAction()
                    }}
                  >
                    <Select name="winner">
                      <SelectTrigger>
                        <SelectValue placeholder="Select winner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={c.player1_id.id}>{c.player1_id.full_name ?? 'Player 1'}</SelectItem>
                        <SelectItem value={c.player2_id.id}>{c.player2_id.full_name ?? 'Player 2'}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" type="submit">
                      Submit
                    </Button>
                  </form>
                )}

                {c.status === 'PROCESSING' &&
                  (c.reported_by?.id !== profile.id ? (
                    <div className="flex items-center gap-2">
                      {c.winner_id === profile.id ? (
                        <span className="text-green-500 font-bold">Won</span>
                      ) : (
                        <span className="text-red-500 font-bold">Lost</span>
                      )}
                      <Button
                        size="sm"
                        onClick={() =>
                          window.fetch(`/api/matches/${c.id}/verify?verify=yes&token=${c.action_token}`).then(() => onAction())
                        }
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          window.fetch(`/api/matches/${c.id}/verify?verify=no&token=${c.action_token}`).then(() => onAction())
                        }
                      >
                        Dispute
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Awaiting verification</p>
                  ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
