'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { supabase } from '../supabase/client'

// Helper to get authenticated user and their admin profiles
async function getAdminUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { data: profiles } = await supabase
        .from('player_profiles')
        .select('sport_id')
        .eq('user_id', user.id)
        .eq('is_admin', true)

    if (!profiles || profiles.length === 0) {
        throw new Error('Forbidden: Admin access required')
    }

    // Return the set of sport IDs this user manages
    const adminSportIds = new Set(profiles.map(p => p.sport_id))
    return { supabase, user, adminSportIds }
}

async function verifySportAdmin(sportId: string) {
    const { supabase, adminSportIds } = await getAdminUser()
    if (!adminSportIds.has(sportId)) {
        throw new Error('Forbidden: You are not an admin for this sport')
    }
    return { supabase }
}

async function verifyMatchAdmin(matchId: string) {
    const { supabase, adminSportIds } = await getAdminUser()

    // Fetch match sport_id
    const { data: match } = await supabase
        .from('matches')
        .select('sport_id')
        .eq('id', matchId)
        .single()

    if (!match) throw new Error('Match not found')

    if (!adminSportIds.has(match.sport_id)) {
        throw new Error('Forbidden: You are not an admin for this match\'s sport')
    }
    return { supabase }
}

export async function addSport(name: string, scoring_config: any = { type: 'simple' }) {
    const { supabase } = await getAdminUser() // Any admin can add a sport for now

    const { error } = await supabase.from('sports').insert({ name, scoring_config })
    if (error) throw new Error(error.message)

    revalidatePath('/')
    revalidatePath('/admin/sports')
    return { success: true }
}

export async function updateSport(sportId: string, data: { name?: string, scoring_config?: any }) {
    const { supabase } = await verifySportAdmin(sportId) // Verify admin rights for this sport

    const { error } = await supabase.from('sports').update(data).eq('id', sportId)
    if (error) throw new Error(error.message)

    revalidatePath('/')
    revalidatePath('/admin/sports')
    return { success: true }
}

export async function cancelMatch(matchId: string) {
    const { supabase } = await verifyMatchAdmin(matchId)

    const { error } = await supabase
        .from('matches')
        .update({ status: 'CANCELLED', winner_id: null })
        .eq('id', matchId)

    if (error) throw new Error(error.message)

    revalidatePath('/match-history')
    revalidatePath('/admin/matches')
    revalidatePath(`/matches/${matchId}`)
}

export async function updateMatchResult(matchId: string, winnerId: string | null, status: string, scores?: any) {
    const { supabase } = await verifyMatchAdmin(matchId)

    const updates: any = { status }
    if (winnerId) updates.winner_id = winnerId
    if (status === 'PENDING') updates.winner_id = null
    if (scores !== undefined) updates.scores = scores

    const { error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', matchId)

    if (error) throw new Error(error.message)

    revalidatePath('/match-history')
    revalidatePath('/admin/matches')
    revalidatePath(`/matches/${matchId}`)
}

export async function toggleAdmin(profileId: string, isAdmin: boolean) {
    const { supabase, adminSportIds } = await getAdminUser()



    const { error } = await supabase
        .from('player_profiles')
        .update({ is_admin: isAdmin })
        .eq('id', profileId)

    if (error) throw new Error(error.message)

    revalidatePath('/admin/users')
}

export async function recalculateElo() {
    const { supabase } = await getAdminUser() // Global action

    const { error } = await supabase.rpc('recompute_all_elos_and_history')

    if (error) throw new Error(error.message)

    revalidatePath('/')
    revalidatePath('/ladder')
    revalidatePath('/match-history')
}

export async function processMatchElo(matchId: string) {
    const { supabase } = await verifyMatchAdmin(matchId)

    const { data, error } = await supabase.rpc('process_match_elo', { match_uuid: matchId })

    if (error) throw new Error(error.message)

    revalidatePath('/match-history')
    revalidatePath('/admin/matches')
    revalidatePath(`/matches/${matchId}`)
    return data
}

export async function createAdminMatch(sportId: string, player1Id: string, player2Id: string) {
    const { supabase } = await verifySportAdmin(sportId)

    const { data, error } = await supabase
        .from('matches')
        .insert({
            sport_id: sportId,
            player1_id: player1Id,
            player2_id: player2Id,
            status: 'PENDING'
        })
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/admin/matches')
    revalidatePath('/match-history')
    return data
}
