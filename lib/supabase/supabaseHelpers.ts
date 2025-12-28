'use server'
import { supabase } from '@/lib/supabase/client'

export async function getMatchesForProfile(profileId: string, limit = 5) {
  // Fetch matches (player ids only) then resolve full_name/avatar via player_profiles_view
  const { data } = await supabase
    .from('matches')
    .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  // collect unique profile ids referenced in these matches
  const ids = Array.from(new Set(data.flatMap((m: any) => [m.player1_id, m.player2_id].filter(Boolean))))
  const profilesMap: Record<string, any> = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('player_profiles_view')
      .select('id, full_name, avatar_url, rating')
      .in('id', ids as any)
    ;(profiles || []).forEach((p: any) => { profilesMap[p.id] = p })
  }

  const finalStatuses = ['CONFIRMED', 'PROCESSED']

  return data.map((m: any) => {
    const isPlayer1 = m.player1_id === profileId
    const opponentId = isPlayer1 ? m.player2_id : m.player1_id
    const opponent = opponentId ? profilesMap[opponentId] : null
    const result = finalStatuses.includes(m.status) ? (m.winner_id === profileId ? 'win' : 'loss') : m.status
    return {
      id: m.id,
      sport_id: m.sport_id,
      opponent: opponent ? { id: opponent.id, full_name: opponent.full_name, rating: opponent.rating, avatar_url: opponent.avatar_url } : null,
      status: m.status,
      result,
      created_at: m.created_at
    }
  })
}

export async function getProfileStats(profileId: string) {
  const { data } = await supabase
    .from('matches')
    .select('id, winner_id, status')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)

  const finalStatuses = ['CONFIRMED', 'PROCESSED']
  const finished = (data || []).filter((m: any) => finalStatuses.includes(m.status))
  const wins = finished.filter((m: any) => m.winner_id === profileId).length
  const losses = finished.length - wins
  const total = finished.length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
  return { total, wins, losses, winRate }
}

export async function getPendingChallengesForProfile(profileId: string) {
  // Fetch matches (player ids only) then resolve names via player_profiles_view
  const { data } = await supabase
    .from('matches')
    .select('id, sport_id, player1_id, player2_id, status, message, action_token, winner_id, reported_by, created_at')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
    .in('status', ['CHALLENGED', 'PENDING', 'PROCESSING'])
    .order('created_at', { ascending: false })

  if (!data) return []

  // resolve player names/avatars (include reported_by in the id list)
  const ids = Array.from(new Set(data.flatMap((m: any) => [m.player1_id, m.player2_id, m.reported_by].filter(Boolean))))
  const profilesMap: Record<string, any> = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('player_profiles_view')
      .select('id, full_name, avatar_url, rating')
      .in('id', ids as any)
    ;(profiles || []).forEach((p: any) => { profilesMap[p.id] = p })
  }

  return (data || []).map((m: any) => ({
    ...m,
    player1_id: m.player1_id ? { id: m.player1_id, full_name: profilesMap[m.player1_id]?.full_name, avatar_url: profilesMap[m.player1_id]?.avatar_url, rating: profilesMap[m.player1_id]?.rating } : null,
    player2_id: m.player2_id ? { id: m.player2_id, full_name: profilesMap[m.player2_id]?.full_name, avatar_url: profilesMap[m.player2_id]?.avatar_url, rating: profilesMap[m.player2_id]?.rating } : null,
    reported_by: m.reported_by ? { id: m.reported_by, full_name: profilesMap[m.reported_by]?.full_name, avatar_url: profilesMap[m.reported_by]?.avatar_url, rating: profilesMap[m.reported_by]?.rating } : null
  }))
}

export async function getRankForProfile(profileId: string, sportId: string) {
  const { data } = await supabase
    .from('player_profiles_view')
    .select('id, rating')
    .eq('sport_id', sportId)
    .order('rating', { ascending: false })

  const players = data || []
  const ranks: number[] = []
  let lastRank = 0
  for (let i = 0; i < players.length; i++) {
    if (i === 0) { ranks.push(1); lastRank = 1 }
    else {
      if (players[i].rating === players[i - 1].rating) { ranks.push(lastRank) }
      else { ranks.push(i + 1); lastRank = i + 1 }
    }
  }

  const idx = players.findIndex((p: any) => p.id === profileId)
  if (idx === -1) return { rank: null, total: players.length }
  return { rank: ranks[idx], total: players.length }
}

export async function getRatingHistory(profileId: string, limit = 100) {
  const { data } = await supabase
    .from('ratings_history')
    .select('id, match_id, old_rating, new_rating, delta, reason, created_at')
    .eq('player_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data || []
}
