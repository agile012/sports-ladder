
export type ScoringConfig = {
  type: 'simple' | 'sets'
  total_sets?: number
  points_per_set?: number
  win_by?: number
  cap?: number
  max_challenge_range?: number
  max_challenge_below?: number
  challenge_window_days?: number
  rematch_cooldown_days?: number
  notifications?: {
    on_challenge?: boolean
    on_challenge_action?: boolean
    on_match_result?: boolean
    on_match_confirmed?: boolean // Verification completed (final result)
  }
}

export type Sport = {
  id: string
  name: string
  scoring_config?: ScoringConfig
}

export type PlayerProfile = {
  id: string
  user_id: string
  sport_id: string
  rating: number
  matches_played: number
  user_email?: string
  user_metadata?: unknown
  full_name?: string
  avatar_url?: string
  is_admin?: boolean
}

export type PlayerBasic = {
  id: string
  full_name?: string
  avatar_url?: string
}

export type Match = {
  id: string
  sport_id: string
  sports?: { id: string; name: string; scoring_config?: any } | null
  player1_id: string | null
  player2_id: string | null
  status: string
  message?: string | null
  action_token?: string | null
  winner_id?: string | null
  reported_by?: string | null
  created_at: string
  scores?: any
}

export type MatchWithPlayers = Omit<Match, 'player1_id' | 'player2_id' | 'reported_by'> & {
  sport_name?: string | null
  player1: PlayerBasic | null
  player2: PlayerBasic | null
  reported_by: PlayerBasic | null
}

export type RankedPlayerProfile = PlayerProfile & {
  rank: number
}

export type MatchResult = 'win' | 'loss' | null

export type MatchHistoryItem = {
  id: string
  created_at: string
  status: string
  result?: MatchResult
  sport_id?: string
  sport_name?: string
  player1_id?: string | null
  player2_id?: string | null
  winner_id?: string | null
  opponent?: PlayerBasic | null
  scores?: any
}

export type PendingChallengeItem = {
  id: string
  sport_id: string
  sports?: { scoring_config?: any }
  player1: PlayerBasic
  player2: PlayerBasic
  status: string
  message?: string | null
  action_token?: string | null
  winner_id?: string | null
  reported_by?: { id: string } | null
  created_at: string
  result?: MatchResult
  scores?: any
}

export type RatingHistoryEntry = {
  id: string
  player_profile_id: string
  match_id: string
  old_rating: number
  new_rating: number
  delta: number
  reason: string
  created_at: string
}

export type PlayerStats = {
  total: number
  wins: number
  losses: number
  winRate: number
}

export type RankInfo = {
  rank: number | null
  total: number
}

export type RatingHistoryItem = {
  created_at: string
  new_rating: number
}

export type PlayerProfileExtended = PlayerProfile & {
  sport_name?: string
  stats?: PlayerStats
  rankInfo?: RankInfo
  recentMatches?: MatchHistoryItem[]
  pendingChallenges?: PendingChallengeItem[]
  ratingHistory?: RatingHistoryItem[]
}