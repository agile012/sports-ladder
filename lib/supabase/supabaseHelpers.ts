'use server'
import { supabase } from '@/lib/supabase/client'
import {
  Match,
  PlayerProfile,
  MatchHistoryItem,
  PlayerStats,
  PendingChallengeItem,
  RankInfo,
  RatingHistoryItem,
  MatchResult,
} from '@/lib/types'

export async function getMatchesForProfile(profileId: string, limit = 5): Promise<MatchHistoryItem[]> {
  // Fetch matches (include sport name via relation) then resolve full_name/avatar via player_profiles_view
  const { data } = await supabase
    .from('matches')
    .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at, scores, sports(id, name)')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  const matches = data as any[]

  // collect unique profile ids referenced in these matches
  const ids = Array.from(new Set(matches.flatMap((m) => [m.player1_id, m.player2_id].filter(Boolean)))) as string[]
  const profilesMap: Record<string, PlayerProfile> = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('player_profiles_view')
      .select('id, full_name, avatar_url, rating')
      .in('id', ids)
      ; (profiles as PlayerProfile[] || []).forEach((p) => {
        profilesMap[p.id] = p
      })
  }

  const finalStatuses = ['CONFIRMED', 'PROCESSED']

  return matches.map((m) => {
    const isPlayer1 = m.player1_id === profileId
    const opponentId = isPlayer1 ? m.player2_id : m.player1_id
    const opponent = opponentId ? profilesMap[opponentId] : null
    const result: MatchResult = finalStatuses.includes(m.status) ? (m.winner_id === profileId ? 'win' : 'loss') : null
    return {
      id: m.id,
      created_at: m.created_at,
      status: m.status,
      sport_id: m.sport_id,
      sport_name: (m.sports && (m.sports as any).name) || null,
      result,
      scores: m.scores,
      opponent: opponent ? { id: opponent.id, full_name: opponent.full_name, avatar_url: opponent.avatar_url } : null,
    }
  })
}

export async function getMatchesSince(profileId: string, days: number): Promise<MatchHistoryItem[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const { data } = await supabase
    .from('matches')
    .select('id, sport_id, player1_id, player2_id, winner_id, status, created_at')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
    .gt('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false })

  if (!data) return []

  const matches = data as any[]
  const ids = Array.from(new Set(matches.flatMap((m) => [m.player1_id, m.player2_id].filter(Boolean)))) as string[]

  const profilesMap: Record<string, PlayerProfile> = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('player_profiles_view')
      .select('id, full_name, avatar_url, rating')
      .in('id', ids)
      ; (profiles as PlayerProfile[] || []).forEach((p) => {
        profilesMap[p.id] = p
      })
  }

  const finalStatuses = ['CONFIRMED', 'PROCESSED']

  return matches.map((m) => {
    const isPlayer1 = m.player1_id === profileId
    const opponentId = isPlayer1 ? m.player2_id : m.player1_id
    const opponent = opponentId ? profilesMap[opponentId] : null
    const result: MatchResult = finalStatuses.includes(m.status) ? (m.winner_id === profileId ? 'win' : 'loss') : null

    return {
      id: m.id,
      created_at: m.created_at,
      status: m.status,
      sport_id: m.sport_id,
      sport_name: null,
      result,
      scores: null,
      opponent: opponent ? { id: opponent.id, full_name: opponent.full_name, avatar_url: opponent.avatar_url } : null,
    }
  })
}

export async function getProfileStats(profileId: string): Promise<PlayerStats> {
  const { data } = await supabase
    .from('matches')
    .select('id, winner_id, status')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)

  const matches = (data as Pick<Match, 'id' | 'winner_id' | 'status'>[]) || []
  const finalStatuses = ['CONFIRMED', 'PROCESSED']
  const finished = matches.filter((m) => finalStatuses.includes(m.status))
  const wins = finished.filter((m) => m.winner_id === profileId).length
  const losses = finished.length - wins
  const total = finished.length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  return { total, wins, losses, winRate }
}

export async function getPendingChallengesForProfile(profileId: string): Promise<PendingChallengeItem[]> {
  // Fetch matches (player ids only) then resolve names via player_profiles_view
  const { data } = await supabase
    .from('matches')
    .select('id, sport_id, player1_id, player2_id, status, message, action_token, winner_id, reported_by, created_at, scores, sports(scoring_config)')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
    .in('status', ['CHALLENGED', 'PENDING', 'PROCESSING'])
    .order('created_at', { ascending: false })

  if (!data) return []

  // cast to any first because specific sports fields (id, name) are missing from this specific query
  const matches = data as any[]

  // resolve player names/avatars (include reported_by in the id list)
  const ids = Array.from(new Set(matches.flatMap((m) => [m.player1_id, m.player2_id, m.reported_by].filter(Boolean)))) as string[]
  const profilesMap: Record<string, PlayerProfile> = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('player_profiles_view')
      .select('id, full_name, avatar_url, rating')
      .in('id', ids)
      ; (profiles as PlayerProfile[] || []).forEach((p) => {
        profilesMap[p.id] = p
      })
  }

  return matches.map((m) => ({
    id: m.id,
    sport_id: m.sport_id,
    sports: m.sports as any, // contains scoring_config
    status: m.status,
    scores: m.scores,
    message: m.message,
    action_token: m.action_token,
    winner_id: m.winner_id,
    created_at: m.created_at,
    player1: m.player1_id
      ? { id: m.player1_id, full_name: profilesMap[m.player1_id]?.full_name, avatar_url: profilesMap[m.player1_id]?.avatar_url }
      : { id: 'unknown' },
    player2: m.player2_id
      ? { id: m.player2_id, full_name: profilesMap[m.player2_id]?.full_name, avatar_url: profilesMap[m.player2_id]?.avatar_url }
      : { id: 'unknown' },
    reported_by: m.reported_by && profilesMap[m.reported_by]
      ? { id: m.reported_by, full_name: profilesMap[m.reported_by]?.full_name, avatar_url: profilesMap[m.reported_by]?.avatar_url }
      : m.reported_by ? { id: m.reported_by } : null,
  }))
}

export async function getRankForProfile(profileId: string, sportId: string): Promise<RankInfo> {
  // Fetch the specific player's ladder_rank
  const { data: profile } = await supabase
    .from('player_profiles_view')
    .select('ladder_rank')
    .eq('id', profileId)
    .single()

  // Count total active players in this sport (using view to match ladder display logic)
  const { count } = await supabase
    .from('player_profiles_view')
    .select('id', { count: 'exact', head: true })
    .eq('sport_id', sportId)
    .not('ladder_rank', 'is', null)

  return {
    rank: profile?.ladder_rank ?? null,
    total: count ?? 0
  }
}

export async function getRatingHistory(profileId: string, limit = 100): Promise<RatingHistoryItem[]> {
  const { data } = await supabase
    .from('ratings_history')
    .select('id, match_id, old_rating, new_rating, delta, reason, created_at')
    .eq('player_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data as { created_at: string; new_rating: number }[]) || []).map((item) => ({
    created_at: item.created_at,
    new_rating: item.new_rating,
  }))
}

export async function getRankHistory(profileId: string, limit = 100): Promise<import('@/lib/types').RankHistoryItem[]> {
  const { data } = await supabase
    .from('ladder_rank_history')
    .select('id, match_id, old_rank, new_rank, reason, created_at')
    .eq('player_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data as any[]) || []).map((item) => ({
    created_at: item.created_at,
    new_rank: item.new_rank,
    old_rank: item.old_rank,
    reason: item.reason
  }))
}
