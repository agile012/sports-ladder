'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useUser from '@/lib/hooks/useUser'
import useLadders from '@/lib/hooks/useLadders'

export default function Home() {
  const { user, loading } = useUser()
  const { sports, getPlayersForSport, getUserProfileForSport, createChallenge } = useLadders()
  const [sportId, setSportId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [topLists, setTopLists] = useState<Record<string, any[]>>({})
  const [challengeLists, setChallengeLists] = useState<Record<string, any[]>>({})
  const [loadingLists, setLoadingLists] = useState(false)
  const [pendingChallenges, setPendingChallenges] = useState<any[]>([])
  const [userProfileIds, setUserProfileIds] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    if (sports.length > 0 && !sportId) setSportId(sports[0].id)
  }, [sports])

  // fetch top 5 and challengable lists for each sport
  useEffect(() => {
    async function loadLists() {
      setLoadingLists(true)
      const tops: Record<string, any[]> = {}
      const challengables: Record<string, any[]> = {}

      for (const s of sports) {
        const players = await getPlayersForSport(s.id) // fetch full list
        tops[s.id] = players.slice(0, 5)

        if (user) {
          const myProfile = await getUserProfileForSport(user.id, s.id)
          if (myProfile) {
            // compute ranks with ties (same algorithm as ladder page)
            const ranks: number[] = []
            let lastRank = 0
            for (let i = 0; i < players.length; i++) {
              if (i === 0) {
                ranks.push(1)
                lastRank = 1
              } else {
                const prev = players[i - 1]
                if (players[i].rating === prev.rating) {
                  ranks.push(lastRank)
                } else {
                  ranks.push(i + 1)
                  lastRank = i + 1
                }
              }
            }

            const myIndex = players.findIndex(p => p.user_id === user.id || p.id === myProfile.id)
            const myRank = myIndex >= 0 ? ranks[myIndex] : null

            if (myRank) {
              let challengable: any[] = []

              // If the user is in the top 10, they can challenge any of the top 10 players
              if (myRank <= 10) {
                challengable = players
                  .map((p, i) => ({ ...p, rank: ranks[i] }))
                  .filter(p => p.id !== myProfile.id && p.rank <= 10)
                  .slice(0, 10)
              } else {
                // Otherwise they can challenge up to 10 ranks above
                const minRank = Math.max(1, myRank - 10)
                challengable = players
                  .map((p, i) => ({ ...p, rank: ranks[i] }))
                  .filter(p => p.rank < myRank && p.rank >= minRank)
                  .slice(0, 10)
              }

              challengables[s.id] = challengable
            } else {
              challengables[s.id] = []
            }
          } else {
            challengables[s.id] = []
          }
        } else {
          challengables[s.id] = []
        }
      }

      setTopLists(tops)
      setChallengeLists(challengables)
      setLoadingLists(false)

      // load user's player profiles and pending challenges for signed-in user
      if (user) {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: profiles } = await supabase.from('player_profiles').select('id').eq('user_id', user.id)
          setUserProfileIds((profiles || []).map((p: any) => p.id))

          const pending = await getPendingChallengesForUser(user.id)
          setPendingChallenges(pending)
        } catch (e) {
          setPendingChallenges([])
          setUserProfileIds([])
        }
      } else {
        setPendingChallenges([])
        setUserProfileIds([])
      }
    }

    if (sports.length > 0) loadLists()
  }, [sports, user])

  async function join() {
    if (!user) {
      router.push('/login')
      return
    }
    if (!sportId) {
      setMessage('Please select a sport to join.')
      return
    }

    // ask for confirmation before joining
    const sportName = sports.find(s => s.id === sportId)?.name ?? 'this sport'
    const confirmed = window.confirm(`Join ${sportName} ladder? Are you sure you want to join?`)
    if (!confirmed) return

    setSubmitting(true)
    setMessage(null)

    const { error } = await (await import('@/lib/supabase')).supabase.from('player_profiles').insert({ user_id: user.id, sport_id: sportId })
    setSubmitting(false)

    if (error) {
      // handle unique constraint error (already joined)
      if (error.code === '23505' || /duplicate|unique/.test(error.message || '')) {
        setMessage('You already joined this sport.')
      } else {
        setMessage(error.message)
      }
      return
    }

    setMessage('Joined! Redirecting to the ladder...')
    // Redirect to the ladder for the joined sport
    router.push(`/ladder?sport=${sportId}`)
  }

  async function handleChallenge(sportId: string, opponentProfileId: string) {
    if (!user) {
      router.push('/login')
      return
    }

    const myProfile = await getUserProfileForSport(user.id, sportId)
    if (!myProfile) {
      setMessage('Join this sport before challenging someone.')
      return
    }

    setSubmitting(true)
    try {
      await createChallenge(sportId, myProfile.id, opponentProfileId)
      setMessage('Challenge sent!')
      // refresh lists
      const players = await getPlayersForSport(sportId)
      setTopLists(prev => ({ ...prev, [sportId]: players.slice(0, 5) }))
      // recompute challengables for the sport
      const ranks: number[] = []
      let lastRank = 0
      for (let i = 0; i < players.length; i++) {
        if (i === 0) {
          ranks.push(1)
          lastRank = 1
        } else {
          const prev = players[i - 1]
          if (players[i].rating === prev.rating) {
            ranks.push(lastRank)
          } else {
            ranks.push(i + 1)
            lastRank = i + 1
          }
        }
      }

      const myIndex = players.findIndex(p => p.user_id === user.id || p.id === myProfile.id)
      const myRank = myIndex >= 0 ? ranks[myIndex] : null
      if (myRank) {
        let challengable: any[] = []
        if (myRank <= 10) {
          challengable = players
            .map((p, i) => ({ ...p, rank: ranks[i] }))
            .filter(p => p.id !== myProfile.id && p.rank <= 10)
            .slice(0, 10)
        } else {
          const minRank = Math.max(1, myRank - 10)
          challengable = players
            .map((p, i) => ({ ...p, rank: ranks[i] }))
            .filter(p => p.rank < myRank && p.rank >= minRank)
            .slice(0, 10)
        }
        setChallengeLists(prev => ({ ...prev, [sportId]: challengable }))
      }
    } catch (err: any) {
      setMessage(err?.message || 'Unable to create challenge')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div>Loading…</div>

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
      <main className="md:col-span-3 space-y-6">
        {sports.map(s => (
          <div key={s.id} className="bg-white p-4 rounded shadow mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{s.name} — Top 5</h2>
              <a className="text-sm text-blue-600" href={`/ladder?sport=${s.id}`}>View ladder</a>
            </div>

            <ol className="divide-y mb-3">
              {(topLists[s.id] || []).map((p: any, i: number) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {p.avatar_url || p.user_metadata?.avatar_url ? (
                      <img src={p.avatar_url ?? p.user_metadata?.avatar_url} alt={(p.full_name ?? p.user_email ?? '').toString()} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm text-gray-500">{(p.full_name ?? p.user_metadata?.full_name ?? p.user_email ?? '').toString()[0] ?? 'U'}</div>
                    )}

                    <div>
                      <div className="font-medium">{p.full_name ?? p.user_metadata?.full_name ?? p.user_email}</div>
                      <div className="text-xs text-gray-500">Rating: {p.rating}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div>
              <h3 className="font-medium mb-2">Players you can challenge</h3>
              {loadingLists ? (
                <div>Loading…</div>
              ) : (challengeLists[s.id] && challengeLists[s.id].length > 0) ? (
                <ol className="divide-y">
                  {challengeLists[s.id].map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        {p.avatar_url || p.user_metadata?.avatar_url ? (
                          <img src={p.avatar_url ?? p.user_metadata?.avatar_url} alt={(p.full_name ?? p.user_email ?? '').toString()} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm text-gray-500">{(p.full_name ?? p.user_metadata?.full_name ?? p.user_email ?? '').toString()[0] ?? 'U'}</div>
                        )}

                        <div>
                          <div className="font-medium">{p.full_name ?? p.user_metadata?.full_name ?? p.user_email}</div>
                          <div className="text-xs text-gray-500">Rank: {p.rank} • Rating: {p.rating}</div>
                        </div>
                      </div>

                      <div>
                        <button onClick={() => {
                          const name = p.full_name ?? p.user_metadata?.full_name ?? 'this player'
                          if (!window.confirm(`Challenge ${name}? Are you sure you want to send this challenge?`)) return
                          handleChallenge(s.id, p.id)
                        }} disabled={submitting} className="bg-red-600 text-white px-3 py-1 rounded">Challenge</button>
                      </div>
                    </li>
                  ))} 
                </ol>
              ) : (
                <div className="text-sm text-gray-500">No challengable players (join and participate to see challengable range).</div>
              )}
            </div>
          </div>
        ))}
      </main>

      <aside className="md:col-span-1">
        <div className="bg-white p-6 rounded shadow">
          <h1 className="text-xl font-semibold mb-4">Join a Ladder</h1>

          {!user ? (
            <div className="text-center">
              <p className="mb-4">You need to sign in with Google to join a ladder.</p>
              <button onClick={() => router.push('/login')} className="bg-blue-600 text-white px-4 py-2 rounded">Sign in</button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium">Choose sport</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {sports.map(s => {
                  const selected = sportId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSportId(s.id)}
                      className={`px-3 py-2 rounded border transition ${selected ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      aria-pressed={selected}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={join} disabled={submitting} className="w-32 bg-green-600 text-white px-4 py-2 rounded text-center">
                  <span className="truncate">{submitting ? 'Joining…' : 'Join Ladder'}</span>
                </button>
                <button onClick={() => router.push('/ladder')} className="w-32 text-sm text-gray-600 border rounded px-3 py-2 text-center">View ladders</button>
              </div>

              {message && <div className="text-sm text-gray-700">{message}</div>}

              {/* User pending challenges */}
              {pendingChallenges.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Your pending challenges</h4>
                  <ul className="space-y-2">
                    {pendingChallenges.map(c => (
                      <li key={c.id} className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm font-medium">{c.status} • {c.sport_id}</div>
                          <div className="text-xs text-gray-500">{c.message ?? ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            {c.status === 'CHALLENGED' && <a href={`/api/matches/${c.id}/action?action=accept&token=${c.action_token}`} className="text-sm bg-green-600 text-white px-2 py-1 rounded">Accept</a>}
                          {c.status === 'CHALLENGED' && <a href={`/api/matches/${c.id}/action?action=reject&token=${c.action_token}`} className="text-sm bg-red-600 text-white px-2 py-1 rounded">Reject</a>}

                          {c.status === 'PENDING' && (
                            <form onSubmit={async (e) => {
                              e.preventDefault()
                              const form = e.target as HTMLFormElement
                              const data = new FormData(form)
                              const winner = data.get('winner') as string
                              await fetch(`/api/matches/${c.id}/submit-result`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ winner_profile_id: winner, reported_by: myProfileId, token: c.action_token }) })
                              location.reload()
                            }} className="flex items-center gap-2">
                              <select name="winner" className="text-sm">
                                <option value={c.player1_id.id}>{c.player1_id.full_name ?? 'Player 1'}</option>
                                <option value={c.player2_id.id}>{c.player2_id.full_name ?? 'Player 2'}</option>
                              </select>
                              <button type="submit" className="text-sm bg-blue-600 text-white px-2 py-1 rounded">Submit result</button>
                            </form>
                          )}

                          {c.status === 'PROCESSING' && (() => {
                            const amPlayer1 = userProfileIds.includes(c.player1_id?.id)
                            const amPlayer2 = userProfileIds.includes(c.player2_id?.id)
                            const myProfileId = amPlayer1 ? c.player1_id?.id : amPlayer2 ? c.player2_id?.id : null
                            const reportedWinner = c.winner_id === c.player1_id?.id ? c.player1_id?.full_name : c.winner_id === c.player2_id?.id ? c.player2_id?.full_name : 'Unknown'

                            if (!myProfileId) return <div className="text-xs text-gray-600">Awaiting verification</div>

                            if (c.reported_by?.id === myProfileId) {
                              return <div className="text-xs text-gray-600">Awaiting verification (you submitted the result)</div>
                            }

                            return (
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-gray-600 mr-2">Reported winner: <span className="font-medium">{reportedWinner}</span></div>
                                <a href={`/api/matches/${c.id}/verify?verify=yes&token=${c.action_token}`} className="text-sm bg-green-600 text-white px-2 py-1 rounded">Confirm</a>
                                <a href={`/api/matches/${c.id}/verify?verify=no&token=${c.action_token}`} className="text-sm bg-red-600 text-white px-2 py-1 rounded">Dispute</a>
                              </div>
                            )
                          })()}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
