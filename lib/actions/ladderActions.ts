'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function leaveLadder(sportId: string, userId: string) {
    const supabase = await createClient()

    const { error } = await supabase.rpc('leave_ladder', {
        p_sport_id: sportId,
        p_user_id: userId,
    })

    if (error) {
        console.error('Error leaving ladder:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard')
    revalidatePath('/ladder')
    return { success: true }
}

export async function rejoinLadder(sportId: string, userId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('rejoin_ladder', {
        p_sport_id: sportId,
        p_user_id: userId,
    })

    if (error) {
        console.error('Error rejoining ladder:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard')
    revalidatePath('/ladder')
    return { success: true, newRank: data }
}
