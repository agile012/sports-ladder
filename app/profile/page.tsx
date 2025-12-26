'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ProfilePage() {
  const [user, setUser] = useState<any | null>(null)
  const [myPlayers, setMyPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setUser(null)
        setLoading(false)
        return
      }
      setUser(data.user)

      // fetch player profiles for this user using the view (joins to auth.users)
      const [{ data: profiles }, { data: sports }] = await Promise.all([
        supabase
          .from('player_profiles_view')
          .select('id, sport_id, rating, matches_played, full_name, avatar_url')
          .eq('user_id', data.user.id)
          .order('rating', { ascending: false }),
        supabase
          .from('sports')
          .select('id, name')
      ])

      const sportMap = (sports || []).reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.name }), {})
      const profileRows = (profiles || []).map((p: any) => ({ ...p, sport_name: sportMap[p.sport_id] ?? p.sport_id }))

      // fetch stats, last 5 matches and rank for each profile in parallel using helpers
      const helpers = await import('@/lib/supabaseHelpers')
      const extended = await Promise.all(profileRows.map(async (p: any) => {
        const [stats, matches, rankInfo, pendingChallenges, ratingHistory] = await Promise.all([
          helpers.getProfileStats(p.id),
          helpers.getMatchesForProfile(p.id, 5),
          helpers.getRankForProfile(p.id, p.sport_id),
          helpers.getPendingChallengesForProfile(p.id),
          helpers.getRatingHistory(p.id)
        ])
        return { ...p, stats, recentMatches: matches, rankInfo, pendingChallenges, ratingHistory }
      }))

      setMyPlayers(extended)
      setLoading(false)
    })
  }, [])

  // small inline sparkline renderer
  function Sparkline({ points }: { points: number[] }) {
    if (!points || points.length === 0) return null
    const w = 140, h = 36, pad = 4
    const vals = points.slice().reverse() // show oldest -> newest left->right
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const step = (w - pad * 2) / Math.max(1, vals.length - 1)
    const coords = vals.map((v, i) => `${pad + i * step},${pad + (1 - (v - min) / range) * (h - pad * 2)}`)
    const pointsAttr = coords.join(' ')
    return (
      <svg width={w} height={h} className="inline-block align-middle">
        <polyline points={pointsAttr} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }

  if (loading) return <div>Loading…</div>

  if (!user)
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">Please sign in</h2>
        <p className="mb-4">You must sign in with Google to view your profile.</p>
        <Link href="/login" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">Sign in</Link>
      </div>
    )

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" /> : <span className="text-xl text-gray-400">{user.email?.[0]?.toUpperCase()}</span>}
        </div>
        <div>
          <div className="text-xl font-semibold">{user.email}</div>
          <div className="text-sm text-gray-500">Member ID: {user.id}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold">Your Player Profiles</h3>
        {myPlayers.length === 0 ? (
          <div className="text-gray-500 mt-2">You don't have any player profiles yet.</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {myPlayers.map((p: any) => (
              <li key={p.id} className="border p-3 rounded">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.full_name ?? ''} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-lg text-gray-500">{(p.full_name ?? p.user_email ?? '')?.toString()[0]?.toUpperCase() ?? 'U'}</div>
                    )}

                    <div>
                      <div className="font-medium">{p.full_name ?? p.user_email}</div>
                      <div className="text-xs text-gray-500">{p.sport_name}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold">{p.rating}</div>
                    <div className="text-xs text-gray-500">Rank: {p.rankInfo?.rank ?? '—'} / {p.rankInfo?.total ?? '—'}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Lifetime</div>
                    <div className="text-sm font-medium">Matches: {p.stats?.total ?? 0}</div>
                    <div className="text-sm">Wins: {p.stats?.wins ?? 0} • Losses: {p.stats?.losses ?? 0}</div>
                    {p.stats?.winRate != null && <div className="text-xs text-gray-500">Win rate: {p.stats.winRate}%</div>}
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Last 5 matches</div>
                    {p.recentMatches && p.recentMatches.length > 0 ? (
                      <ul className="space-y-1 mt-1">
                        {p.recentMatches.map((m: any) => (
                          <li key={m.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {m.opponent?.avatar_url ? (
                                <img src={m.opponent.avatar_url} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-500">{(m.opponent?.full_name ?? '')?.toString()[0]?.toUpperCase() ?? 'U'}</div>
                              )}
                              <div>{m.opponent?.full_name ?? 'Unknown'}</div>
                            </div>

                            <div className="ml-3 text-xs">
                              {m.result === 'win' ? <span className="text-green-600">Win</span> : m.result === 'loss' ? <span className="text-red-600">Loss</span> : <span className="text-gray-600">{m.status}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-gray-500 mt-1">No recent matches</div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Quick actions</div>
                    <div className="mt-1 space-y-2">
                      <a href={`/ladder?sport=${p.sport_id}`} className="text-sm text-blue-600">View ladder</a>
                      <a href={`/ladder?sport=${p.sport_id}&profile=${p.id}`} className="text-sm text-gray-700">View my position</a>
                    </div>

                    {/* Pending challenges block */}
                    {p.pendingChallenges && p.pendingChallenges.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-500">Pending challenges</div>
                        <ul className="mt-2 space-y-2">
                          {p.pendingChallenges.map((c: any) => (
                            <li key={c.id} className="border rounded p-2 bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium">{c.status} • {c.sport_id}</div>
                                  <div className="text-xs text-gray-600">{c.message ?? ''}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* If the profile is the opponent and status is CHALLENGED show accept/reject */}
                                  {c.status === 'CHALLENGED' && c.player2_id?.id === p.id && (
                                    <>
                                      <button onClick={() => window.fetch(`/api/matches/${c.id}/action?action=accept&token=${c.action_token}`).then(() => location.reload())} className="text-sm bg-green-600 text-white px-2 py-1 rounded">Accept</button>
                                      <button onClick={() => window.fetch(`/api/matches/${c.id}/action?action=reject&token=${c.action_token}`).then(() => location.reload())} className="text-sm bg-red-600 text-white px-2 py-1 rounded">Reject</button>
                                    </>
                                  )}

                                  {/* If status is PENDING allow entering result (select winner) */}
                                  {c.status === 'PENDING' && (
                                    <form className="flex items-center gap-2" onSubmit={async (e) => {
                                      e.preventDefault()
                                      const form = e.target as HTMLFormElement
                                      const data = new FormData(form)
                                      const winner = data.get('winner') as string
                                      await fetch(`/api/matches/${c.id}/submit-result`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ winner_profile_id: winner, reported_by: p.id, token: c.action_token }) })
                                      location.reload()
                                    }}>
                                      <select name="winner" className="text-sm">
                                        <option value={c.player1_id.id}>{c.player1_id.full_name ?? 'Player 1'}</option>
                                        <option value={c.player2_id.id}>{c.player2_id.full_name ?? 'Player 2'}</option>
                                      </select>
                                      <button type="submit" className="text-sm bg-blue-600 text-white px-2 py-1 rounded">Submit result</button>
                                    </form>
                                  )}

                                  {c.status === 'PROCESSING' && (
                                    (c.reported_by?.id !== p.id) ? (
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => window.fetch(`/api/matches/${c.id}/verify?verify=yes&token=${c.action_token}`).then(() => location.reload())} className="text-sm bg-green-600 text-white px-2 py-1 rounded">Confirm result</button>
                                        <button onClick={() => window.fetch(`/api/matches/${c.id}/verify?verify=no&token=${c.action_token}`).then(() => location.reload())} className="text-sm bg-red-600 text-white px-2 py-1 rounded">Dispute</button>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-gray-600">Awaiting verification (you submitted the result)</div>
                                    )
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Rating history timeline */}
                    {p.ratingHistory && p.ratingHistory.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-500">Rating history</div>
                        <div className="mt-2 mb-2">
                          <Sparkline points={(p.ratingHistory || []).map((h: any) => h.new_rating)} />
                        </div>
                        <ul className="mt-2 space-y-1 text-sm">
                          {p.ratingHistory.map((h: any) => (
                            <li key={h.id} className="flex items-center justify-between">
                              <div className="text-xs text-gray-600">{new Date(h.created_at).toLocaleDateString()} • {h.reason}</div>
                              <div className={`font-medium ${h.delta > 0 ? 'text-green-600' : h.delta < 0 ? 'text-red-600' : 'text-gray-600'}`}>{h.delta > 0 ? '+' : ''}{h.delta} ({h.new_rating})</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
