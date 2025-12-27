'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function useLadders() {
  const [sports, setSports] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from('sports')
      .select('id, name')
      .order('name')
      .then(res => setSports(res.data ?? []))
  }, [])

  const getPlayersForSport = useCallback(async (sportId: string, limit?: number) => {
    // Use the view that joins `auth.users` so we can show email/avatar/name
    let query = supabase
      .from('player_profiles_view')
      .select('id, user_id, sport_id, rating, matches_played, user_email, user_metadata, full_name, avatar_url')
      .eq('sport_id', sportId)
      .order('rating', { ascending: false })

    if (limit) query = query.limit(limit)

    const { data } = await query

    return data ?? []
  }, [])

  const getUserProfileForSport = useCallback(async (userId: string, sportId: string) => {
    const { data } = await supabase
      .from('player_profiles')
      .select('id, user_id, sport_id, rating, matches_played')
      .eq('user_id', userId)
      .eq('sport_id', sportId)
      .limit(1)

    return (data && data[0]) ?? null
  }, [])

  const createChallenge = useCallback(
    async (sportId: string, challengerProfileId: string, opponentProfileId: string, message?: string) => {
      if (challengerProfileId === opponentProfileId) throw new Error('Cannot challenge yourself')

      // Check for existing active challenges between these two profiles in this sport
      const { data: existing } = await supabase
        .from('matches')
        .select('id, status')
        .eq('sport_id', sportId)
        .or(
          `and(player1_id.eq.${challengerProfileId},player2_id.eq.${opponentProfileId}),and(player1_id.eq.${opponentProfileId},player2_id.eq.${challengerProfileId})`
        )
        .in('status', ['CHALLENGED', 'PENDING', 'PROCESSING'])
        .limit(1)

      if (existing && existing.length) {
        throw new Error('There is already a pending or processing challenge between these players')
      }

      // Insert a match row with status CHALLENGED to represent a challenge
      const { data, error } = await supabase.from('matches').insert({
        sport_id: sportId,
        player1_id: challengerProfileId,
        player2_id: opponentProfileId,
        status: 'CHALLENGED',
        message: message ?? null,
      })
      if (error) {
        // handle unique constraint from DB (defensive fallback)
        if (error.message && error.message.includes('duplicate key')) {
          throw new Error('There is already a pending or processing challenge between these players')
        }
        throw error
      }
      return data
    },
    []
  )

  const createMatch = useCallback(async (sportId: string, player1Id: string, player2Id: string) => {
    const { data, error } = await supabase.from('matches').insert({ sport_id: sportId, player1_id: player1Id, player2_id: player2Id })
    if (error) throw error
    return data
  }, [])

  // Use helper functions for matches/stats/rank (supabaseHelpers)
  const getMatchesForProfile = useCallback(async (profileId: string, limit = 5) => {
    const { getMatchesForProfile } = await import('../supabaseHelpers')
    return getMatchesForProfile(profileId, limit)
  }, [])

  const getProfileStats = useCallback(async (profileId: string) => {
    const { getProfileStats } = await import('../supabaseHelpers')
    return getProfileStats(profileId)
  }, [])

  const getRankForProfile = useCallback(async (profileId: string, sportId: string) => {
    const { getRankForProfile } = await import('../supabaseHelpers')
    return getRankForProfile(profileId, sportId)
  }, [])

  const getPendingChallengesForUser = useCallback(async (userId: string) => {
    // Find all player profile ids for this user
    const { data: profiles } = await supabase.from('player_profiles').select('id').eq('user_id', userId)
    const ids = (profiles || []).map((r: any) => r.id)
    if (!ids.length) return []

    const { data } = await supabase
      .from('matches')
      .select('id, sport_id, player1_id, player2_id, status, message, action_token, winner_id, reported_by, created_at')
      .or(ids.map((id: string) => `player1_id.eq.${id}`).concat(ids.map((id: string) => `player2_id.eq.${id}`)).join(','))
      .in('status', ['CHALLENGED', 'PENDING', 'PROCESSING'])
      .order('created_at', { ascending: false })

    if (!data) return []

    // Resolve profile info for player ids
    const idsInMatches = Array.from(new Set(data.flatMap((m: any) => [m.player1_id, m.player2_id].filter(Boolean))))
    const profilesMap: Record<string, any> = {}
    if (idsInMatches.length) {
      const { data: profiles } = await supabase
        .from('player_profiles_view')
        .select('id, full_name, avatar_url, rating')
        .in('id', idsInMatches as any)
      ;(profiles || []).forEach((p: any) => {
        profilesMap[p.id] = p
      })
    }

    return (data || []).map((m: any) => ({
      ...m,
      player1_id: m.player1_id
        ? { id: m.player1_id, full_name: profilesMap[m.player1_id]?.full_name, avatar_url: profilesMap[m.player1_id]?.avatar_url, rating: profilesMap[m.player1_id]?.rating }
        : null,
      player2_id: m.player2_id
        ? { id: m.player2_id, full_name: profilesMap[m.player2_id]?.full_name, avatar_url: profilesMap[m.player2_id]?.avatar_url, rating: profilesMap[m.player2_id]?.rating }
        : null,
      reported_by: m.reported_by
        ? { id: m.reported_by, full_name: profilesMap[m.reported_by]?.full_name, avatar_url: profilesMap[m.reported_by]?.avatar_url, rating: profilesMap[m.reported_by]?.rating }
        : null,
    }))
  }, [])

  return { sports, getPlayersForSport, getUserProfileForSport, createChallenge, createMatch, getMatchesForProfile, getProfileStats, getRankForProfile, getPendingChallengesForUser }
}
