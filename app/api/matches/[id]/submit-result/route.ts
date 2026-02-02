import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { Match } from '@/lib/types'

async function handleResultSubmission(
  origin: string,
  id: string,
  winner_profile_id: string,
  token: string | null,
  reported_by: string | null,
  scores?: any
) {
  // recorded reporter defaults to the winner if not provided (useful for token-based submissions)
  // We will determine reporter after auth checks
  let reporter = reported_by

  const supabase = await createClient()
  const matchRes = await supabase.from('matches').select('*').eq('id', id).limit(1).single()
  if (!matchRes.data) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  const match = matchRes.data as Match

  if (token) {
    // If a token is provided, it must match the match's action_token
    if (match.action_token !== token) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  } else {
    // Check for session-based auth
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Resolve user's auth ID to a profile ID for this match
    // We check if the user owns either player1 or player2 profile
    const { data: p1 } = await supabase.from('player_profiles').select('user_id').eq('id', match.player1_id).single()
    const { data: p2 } = await supabase.from('player_profiles').select('user_id').eq('id', match.player2_id).single()

    let userProfileId = null
    if (p1 && p1.user_id === user.id) userProfileId = match.player1_id
    if (p2 && p2.user_id === user.id) userProfileId = match.player2_id

    if (!userProfileId) {
       // If user is admin for this sport, they can also report? 
       // For now, let's stick to participants or allow admin override if we checked admin rights.
       // Current logic enforces reporter is participant. checking match.playerX_id.includes(reporter)
       
       // Let's check admin rights similar to other actions if not participant
       const { data: adminProfile } = await supabase
          .from('player_profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('sport_id', match.sport_id)
          .eq('is_admin', true)
          .single()
          
       if (adminProfile) {
           // If admin, we can default reporter to the winner or keep explicitly provided reported_by if it's a profile ID
           // But lines 43-45 strictly enforce reporter MUST be p1 or p2 logic:
           // "if (![match.player1_id, match.player2_id].includes(reporter))"
           // So even admin usage implies we must attribute the report to one of the players (usually the winner).
           // Or we relax the check.
           
           // If admin is reporting, let's assume they are reporting ON BEHALF of the winner.
           userProfileId = winner_profile_id
       } else {
           return NextResponse.json({ error: 'Forbidden: You are not a participant' }, { status: 403 })
       }
    }
    
    // If successfully resolved, use that as reporter
    reported_by = userProfileId
  }

  // If reported_by was still null (e.g. token flow without explicit reporter), default to winner
  reporter = reported_by ?? winner_profile_id

  // validate reporter is one of the match participants
  if (![match.player1_id, match.player2_id].includes(reporter)) {
    return NextResponse.json({ error: 'Invalid reporter' }, { status: 400 })
  }

  // check match is in a state to accept results
  if (match.status !== 'PENDING') {
    return NextResponse.json({ error: `Cannot submit result for match in status ${match.status}` }, { status: 400 })
  }

  // update match to PROCESSING and record tentative winner in `winner_id` and who reported it. Also save scores.
  const { error } = await supabase.from('matches').update({
    status: 'PROCESSING',
    winner_id: winner_profile_id,
    reported_by: reporter,
    scores: scores ?? null
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger Inngest event for email notification
  await inngest.send({
    name: 'match.result',
    data: { matchId: match.id },
  })

  return NextResponse.redirect(origin, { status: 303 })
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return new NextResponse(
    `<html>
      <head><title>Submit Result</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4f4f5;">
        <div style="background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%;">
          <h1 style="margin-top: 0; font-size: 1.5rem; color: #18181b;">Submit Result</h1>
          <p style="color: #52525b; margin-bottom: 1.5rem;">Confirm submission of match result?</p>
          <form method="POST">
            <button type="submit" style="background: #18181b; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 500; cursor: pointer; width: 100%;">Submit</button>
          </form>
        </div>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // await the params object in case it's a Promise (Next.js App Router)
  const { id } = (await params) as { id: string }

  let winner_profile_id, token, reported_by, scores

  // Try to parse JSON, fallback to search params (for HTML form submission from GET page)
  try {
    const body = await req.json()
    winner_profile_id = body.winner_profile_id
    token = body.token
    reported_by = body.reported_by
    scores = body.scores
  } catch (e) {
    const { searchParams } = new URL(req.url)
    winner_profile_id = searchParams.get('winner_profile_id')
    token = searchParams.get('token')
    reported_by = searchParams.get('reported_by')
    // scores via searchParams is complex/unlikely, can ignore for now or parse if needed
  }

  if (!winner_profile_id) return NextResponse.json({ error: 'Missing winner_profile_id' }, { status: 400 })

  // Validate reported_by if provided
  if (reported_by) {
    // Basic UUID check could go here
  }

  const origin = process.env.PUBLIC_SITE_URL ?? new URL(req.url).origin

  return handleResultSubmission(origin, id, winner_profile_id, token, reported_by, scores)
}
