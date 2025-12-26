'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'

export default function Ladder() {
  const { user, loading } = useUser()
  const { sports, getPlayersForSport, getUserProfileForSport, createChallenge } = useLadders()
  const [players, setPlayers] = useState<any[]>([])
  const [selectedSport, setSelectedSport] = useState<any | null>(null)
  const [challengables, setChallengables] = useState<Set<string>>(new Set())
  const [submittingChallenge, setSubmittingChallenge] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // when sports are available, set selected sport from query param if present
  useEffect(() => {
    const sportParam = searchParams.get('sport')
    if (!sportParam || sports.length === 0) return

    const found = sports.find(s => s.id === sportParam)
    if (found) setSelectedSport(found)
  }, [sports, searchParams])

  // fetch players when selected sport changes
  useEffect(() => {
    if (!selectedSport) return
    let cancelled = false

    ;(async () => {
      const p = await getPlayersForSport(selectedSport.id)
      if (cancelled) return
      setPlayers(p)
      // update URL without reloading
      router.replace(`/ladder?sport=${selectedSport.id}`, { scroll: false })

      // compute ranks (standard competition ranking)
      const ranks: number[] = []
      let lastRank = 0
      for (let i = 0; i < p.length; i++) {
        if (i === 0) {
          ranks.push(1)
          lastRank = 1
        } else {
          const prev = p[i - 1]
          if (p[i].rating === prev.rating) {
            ranks.push(lastRank)
          } else {
            ranks.push(i + 1)
            lastRank = i + 1
          }
        }
      }

      if (!user) {
        setChallengables(new Set())
        return
      }

      const myProfile = await getUserProfileForSport(user.id, selectedSport.id)
      if (!myProfile) {
        setChallengables(new Set())
        return
      }

      const myIndex = p.findIndex(pp => pp.user_id === user.id || pp.id === myProfile.id)
      const myRank = myIndex >= 0 ? ranks[myIndex] : null

      let challengableArr: any[] = []
      if (myRank) {
        if (myRank <= 10) {
          challengableArr = p
            .map((pp, i) => ({ ...pp, rank: ranks[i] }))
            .filter(pp => pp.id !== myProfile.id && pp.rank <= 10)
            .slice(0, 10)
        } else {
          const minRank = Math.max(1, myRank - 10)
          challengableArr = p
            .map((pp, i) => ({ ...pp, rank: ranks[i] }))
            .filter(pp => pp.rank < myRank && pp.rank >= minRank)
            .slice(0, 10)
        }
      }

      setChallengables(new Set(challengableArr.map(x => x.id)))
    })()

    return () => { cancelled = true }
  }, [selectedSport, user])

  const ranks = useMemo(() => {
    const res: number[] = []
    let lastRank = 0
    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      if (i === 0) {
        res.push(1)
        lastRank = 1
      } else {
        const prev = players[i - 1]
        if (p.rating === prev.rating) {
          res.push(lastRank)
        } else {
          res.push(i + 1)
          lastRank = i + 1
        }
      }
    }
    return res
  }, [players])

  async function handleChallenge(opponentProfileId: string) {
    if (!selectedSport || !user) {
      router.push('/login')
      return
    }

    const myProfile = await getUserProfileForSport(user.id, selectedSport.id)
    if (!myProfile) {
      setMessage('Join this sport before challenging someone.')
      return
    }

    if (!challengables.has(opponentProfileId)) {
      setMessage('You cannot challenge this player.')
      return
    }

    setSubmittingChallenge(opponentProfileId)
    setMessage(null)

    try {
      await createChallenge(selectedSport.id, myProfile.id, opponentProfileId)
      setMessage('Challenge sent!')

      // refresh players and challengables
      const p = await getPlayersForSport(selectedSport.id)
      setPlayers(p)

      // recompute ranks and challengables (same logic as above)
      const ranks2: number[] = []
      let last2 = 0
      for (let i = 0; i < p.length; i++) {
        if (i === 0) { ranks2.push(1); last2 = 1 } else {
          const prev = p[i - 1]
          if (p[i].rating === prev.rating) { ranks2.push(last2) } else { ranks2.push(i + 1); last2 = i + 1 }
        }
      }

      const myIndex = p.findIndex(pp => pp.user_id === user.id || pp.id === myProfile.id)
      const myRank = myIndex >= 0 ? ranks2[myIndex] : null
      let challengableArr: any[] = []
      if (myRank) {
        if (myRank <= 10) {
          challengableArr = p
            .map((pp, i) => ({ ...pp, rank: ranks2[i] }))
            .filter(pp => pp.id !== myProfile.id && pp.rank <= 10)
            .slice(0, 10)
        } else {
          const minRank = Math.max(1, myRank - 10)
          challengableArr = p
            .map((pp, i) => ({ ...pp, rank: ranks2[i] }))
            .filter(pp => pp.rank < myRank && pp.rank >= minRank)
            .slice(0, 10)
        }
      }

      setChallengables(new Set(challengableArr.map(x => x.id)))
    } catch (err: any) {
      setMessage(err?.message || 'Unable to create challenge')
    } finally {
      setSubmittingChallenge(null)
    }
  }

  if (loading) return <div>Loading…</div>

  // allow guests to view ladders; show sign-in CTA in-page (challenge controls remain disabled)
  // nothing returned here — rendering continues below


  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <aside className="md:col-span-1">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Sports</h3>
          <ul className="space-y-2">
            {sports.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => setSelectedSport(s)}
                  className={`w-full text-left px-3 py-2 rounded ${selectedSport?.id === s.id ? 'bg-blue-50 border' : 'hover:bg-gray-50'}`}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="md:col-span-3">
        <div className="bg-white p-4 rounded shadow">
          <h1 className="text-2xl font-bold mb-3">{selectedSport ? `${selectedSport.name} Ladder` : 'Select a sport'}</h1>

          {!user && (
            <div className="bg-yellow-50 border-l-4 border-yellow-300 p-3 rounded mb-3 flex items-center justify-between">
              <div>
                <div className="font-medium">Viewing as guest</div>
                <div className="text-sm text-gray-700">Sign in with Google to join ladders and challenge players.</div>
              </div>
              <div>
                <Link href="/login" className="inline-block bg-blue-600 text-white px-3 py-1 rounded">Sign in</Link>
              </div>
            </div>
          )}

          {message && <div className="text-sm text-gray-700 mb-3">{message}</div>}

          {selectedSport ? (
            <div className="space-y-2">
              {players.length === 0 && <div className="text-gray-500">No players yet.</div>}

              <ol className="divide-y">
                {players.map((p, i) => (
                  <li key={p.id} className={`flex items-center justify-between py-3 ${challengables.has(p.id) ? 'bg-yellow-50 border-l-4 border-yellow-300' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center">
                        {p.avatar_url || p.user_metadata?.avatar_url ? (
                          <img src={p.avatar_url ?? p.user_metadata?.avatar_url} alt={(p.full_name ?? p.user_email ?? '').toString()} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-gray-400">{(p.full_name ?? p.user_metadata?.full_name ?? p.user_email ?? p.user_id ?? '').toString()[0] ?? 'U'}</span>
                        )}
                      </div>

                      <div>
                        <div className="font-medium">{p.full_name ?? p.user_metadata?.full_name ?? p.user_email ?? `Player ${i + 1}`}</div>
                        <div className="text-xs text-gray-500">Rank #{ranks[i]}</div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="text-lg font-bold">{p.rating}</div>
                      <div className="text-xs text-gray-500">Matches: {p.matches_played ?? 0}</div>

                      {selectedSport && user && challengables.has(p.id) ? (
                        <button
                          onClick={() => {
                            const name = p.full_name ?? p.user_metadata?.full_name ?? 'this player'
                            if (!window.confirm(`Challenge ${name}? Are you sure you want to send this challenge?`)) return
                            handleChallenge(p.id)
                          }}
                          disabled={submittingChallenge != null}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm"
                        >
                          {submittingChallenge === p.id ? 'Challenging…' : 'Challenge'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="text-gray-500">Choose a sport to view its ladder.</div>
          )}
        </div>
      </section>
    </div>
  )
}
