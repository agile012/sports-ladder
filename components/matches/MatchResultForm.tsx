"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function MatchResultForm({ matchId, player1, player2, allowed, actionToken }: { matchId: string; player1: any; player2: any; allowed: boolean; actionToken?: string | null }) {
  const [winner, setWinner] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submit() {
    if (!winner) return setError('Choose a winner')
    setLoading(true)
    setError(null)
    try {
      const body: any = { winner_profile_id: winner }
      if (actionToken) body.token = actionToken

      const res = await fetch(`/api/matches/${matchId}/submit-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  if (!allowed) return <p className="text-sm text-muted-foreground">Only players in this match can submit results.</p>

  return (
    <div className="space-y-3">
      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2">
          <input type="radio" name="winner" value={player1?.id} onChange={(e) => setWinner(e.target.value)} />
          <span>{player1?.full_name ?? 'Player 1'}</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="winner" value={player2?.id} onChange={(e) => setWinner(e.target.value)} />
          <span>{player2?.full_name ?? 'Player 2'}</span>
        </label>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={loading} className="w-full">{loading ? 'Submitting…' : 'Submit Result'}</Button>
      </div>
    </div>
  )
}
