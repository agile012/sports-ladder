'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function withdrawChallenge(matchId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Verify match exists and user is the challenger (player1)
    const { data: match, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()

    if (error || !match) throw new Error('Match not found')

    // Check if user owns the player1 profile
    const { data: profile } = await supabase
        .from('player_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', match.player1_id)
        .single()

    if (!profile) throw new Error('You are not the challenger for this match')

    if (match.status !== 'CHALLENGED') throw new Error('Cannot withdraw this challenge')

    // Change status to WITHDRAWN instead of deleting
    const { error: updateError } = await supabase
        .from('matches')
        .update({
            status: 'CANCELLED',
            scores: { reason: 'withdrawn', withdrawn_by: match.player1_id }
        })
        .eq('id', matchId)

    if (updateError) throw new Error(updateError.message)

    revalidatePath('/')
    return { success: true }
}

export async function forfeitMatch(matchId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Verify match exists and user is the defender (player2)
    const { data: match, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()

    if (error || !match) throw new Error('Match not found')

    // Check if user owns the player2 profile
    const { data: profile } = await supabase
        .from('player_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', match.player2_id)
        .single()

    if (!profile) throw new Error('You are not the defender for this match')

    if (match.status !== 'CHALLENGED') throw new Error('Cannot forfeit this match')

    // Set winner to Player 1 (Challenger) and status to CONFIRMED (skips verification)
    const scores = { reason: 'forfeit', forfeited_by: match.player2_id }

    // Using existing schema where scores is JSONB

    // Update match
    const { error: updateError } = await supabase
        .from('matches')
        .update({
            winner_id: match.player1_id,
            scores: scores,
            status: 'CONFIRMED', // Direct confirmation as it is a forfeit
            updated_at: new Date().toISOString()
        })
        .eq('id', matchId)

    if (updateError) throw new Error(updateError.message)

    // Trigger ladder update via stored procedure if not handled by trigger (assuming trigger handles CONFIRMED)
    // The existing trigger/function logic should pick this up

    revalidatePath('/')
    return { success: true }
}
