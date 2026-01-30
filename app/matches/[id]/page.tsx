import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MatchDetailsView from '@/components/matches/MatchDetailsView'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function MatchPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { id } = await params
  const { token, action, winner, reported_by } = await searchParams

  const matchRes = await supabase.from('matches').select('*').eq('id', id).limit(1).maybeSingle()
  if (!matchRes.data) return <div className="max-w-3xl mx-auto p-6">Match not found</div>
  const match = matchRes.data as any

  // fetch player profiles
  const ids = [match.player1_id, match.player2_id].filter(Boolean)
  let profilesMap: Record<string, any> = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('player_profiles_view')
      .select('id, full_name, avatar_url')
      .in('id', ids)
      ; (profiles || []).forEach((p: any) => { profilesMap[p.id] = p })
  }

  // fetch sport details
  let sportName: string | null = null
  if (match.sport_id) {
    const { data: sport } = await supabase.from('sports').select('id, name, scoring_config').eq('id', match.sport_id).maybeSingle()
    if (sport) {
      sportName = sport.name
      match.sport = sport // Attach sport details to match object for MatchDetailsView
    }
  }

  // determine if the current viewer is an authenticated player in this match
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  let allowedToSubmit = false

  // Token validation
  const isValidToken = typeof token === 'string' && token === match.action_token

  if (user) {
    const { data: userProfiles } = await supabase.from('player_profiles').select('id').eq('user_id', user.id)
    const pids = (userProfiles || []).map((p: any) => p.id)
    if (pids.find((pid: string) => pid === match.player1_id || pid === match.player2_id)) allowedToSubmit = true
  }

  // Allow submission if token is valid
  if (isValidToken) {
    allowedToSubmit = true
  }

  const player1 = match.player1_id ? profilesMap[match.player1_id] ?? { id: match.player1_id } : null
  const player2 = match.player2_id ? profilesMap[match.player2_id] ?? { id: match.player2_id } : null

  // fetch rating history
  const { data: historyData } = await supabase
    .from('ratings_history')
    .select('*')
    .eq('match_id', id)
  const history = historyData || []

  // fetch rank history
  const { data: rankHistoryData } = await supabase
    .from('ladder_rank_history')
    .select('*')
    .eq('match_id', id)
  const rankHistory = rankHistoryData || []

  return (
    <MatchDetailsView
      match={match}
      player1={player1}
      player2={player2}
      sportName={sportName}
      currentUser={user}
      allowedToSubmit={allowedToSubmit}
      history={history}
      rankHistory={rankHistory}
      initialToken={isValidToken ? token as string : undefined}
      initialAction={typeof action === 'string' ? action : undefined}
      initialWinnerId={typeof winner === 'string' ? winner : undefined}
      initialReporterId={typeof reported_by === 'string' ? reported_by : undefined}
    />
  )
}
