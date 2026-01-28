'use server'

import { createClient } from '@/lib/supabase/server'

export async function getSportAnalytics(sportId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_sport_analytics', {
        p_sport_id: sportId
    })

    if (error) {
        console.error('Analytics error:', error)
        throw new Error(error.message)
    }

    return data
}
