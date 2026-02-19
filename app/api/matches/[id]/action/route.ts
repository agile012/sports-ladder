import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { createClient } from '@/lib/supabase/server'
import { Match } from '@/lib/types'


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  return new NextResponse(
    `<html>
      <head><title>Confirm Action</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4f4f5;">
        <div style="background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%;">
          <h1 style="margin-top: 0; font-size: 1.5rem; color: #18181b;">Confirm Action</h1>
          <p style="color: #52525b; margin-bottom: 1.5rem;">Are you sure you want to <strong>${action}</strong> this match/challenge?</p>
          <form method="POST">
            <button type="submit" style="background: #18181b; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 500; cursor: pointer; width: 100%;">Yes, ${action}</button>
          </form>
        </div>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const token = searchParams.get('token')

  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  // validate token if provided
  const matchRes = await supabase.from('matches').select('*').eq('id', id).limit(1).single()
  if (!matchRes.data) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  const match = matchRes.data as Match

  if (token) {
    if (match.action_token !== token) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  } else {
    // Check for session-based auth
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: profiles } = await supabase.from('player_profiles').select('id').eq('user_id', user.id)
    const pids = (profiles || []).map((p: any) => p.id)
    const isParticipant = pids.includes(match.player1_id) || pids.includes(match.player2_id)

    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden: You are not a participant' }, { status: 403 })
    }
  }

  // check match is in a state to accept challenge action
  if (match.status !== 'CHALLENGED') {
    return NextResponse.json({ error: `Cannot submit result for match in status ${match.status}` }, { status: 400 })
  }

  if (action === 'accept') {
    // set status to PENDING (accepted) and return the updated row to verify success
    const { data: updated, error } = await supabase.from('matches').update({ status: 'PENDING' }).eq('id', id).select().maybeSingle()
    if (error) {
      console.error('Failed to update match status to PENDING:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) return NextResponse.json({ error: 'No rows updated; match not found or not permitted' }, { status: 500 })
    // Trigger Inngest event for email notification
    try {
      await inngest.send({
        name: 'match.action',
        data: { matchId: updated.id, action: 'accept' },
      })
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to send event: match.action, error:`, error)
    }
    const origin = process.env.PUBLIC_SITE_URL ?? new URL(req.url).origin
    return NextResponse.redirect(origin, { status: 303 })
  }

  if (action === 'withdraw') {
    // Determine who is withdrawing. If token is used, we assume it's the challenger (player1) effectively, 
    // or strictly check if we want. But the token is the "key".
    // For withdraw, we cancel the match.

    // We should probably check if status is CHALLENGED or PENDING
    if (!['CHALLENGED', 'PENDING'].includes(match.status)) {
      return NextResponse.json({ error: `Cannot withdraw match in status ${match.status}` }, { status: 400 })
    }

    const { error } = await supabase.from('matches').update({
      status: 'CANCELLED',
      scores: { reason: 'withdrawn', withdrawn_by: match.player1_id } // attributing to challenger for now as they own the challenge
    }).eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const origin = process.env.PUBLIC_SITE_URL ?? new URL(req.url).origin
    return NextResponse.redirect(origin, { status: 303 })
  }

  if (action === 'forfeit') {
    // Forfeit by the person clicking the link (usually the defender if it's from the challenge email).
    // If using token from email sent to opponent, it is the opponent forfeiting.
    // If we want to be strict, we could check which user the token belongs to if we tracked that, 
    // but `action_token` is on the match.
    // Generally, the "Forfeit" link in the email is sent to the person who can forfeit.

    // If status is CHALLENGED (Defender forfeiting) or PENDING (Either could, but usually handled in UI).
    // From email "Walkover / Forfeit" link in challenge email -> Defender forfeiting.

    if (!['CHALLENGED', 'PENDING'].includes(match.status)) {
      return NextResponse.json({ error: `Cannot forfeit match in status ${match.status}` }, { status: 400 })
    }

    // Logic: Winner is Player 1 (Challenger), Loser is Player 2 (Defender/Forfeiter)
    // We assume the person clicking the link in the email (Defender) is the one forfeiting.
    const scores = { reason: 'forfeit', forfeited_by: match.player2_id }

    const { error } = await supabase.from('matches').update({
      winner_id: match.player1_id,
      scores: scores,
      status: 'CONFIRMED', // Direct confirmation
      updated_at: new Date().toISOString()
    }).eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Trigger result event if needed, or if CONFIRMED handles it via triggers/other listeners.
    // Usually `match.result` handles notifications. 
    // Since it is CONFIRMED, maybe `match.verify` equivalent? 
    // Existing `forfeitMatch` action just updates db.

    const origin = process.env.PUBLIC_SITE_URL ?? new URL(req.url).origin
    return NextResponse.redirect(origin, { status: 303 })
  }

  // Note: reject action has been removed - challenges can no longer be rejected

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
