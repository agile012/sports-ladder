'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getProfilePageData } from './profile'

export type VerificationRequest = {
    id: string
    email: string
    status: 'pending' | 'verified' | 'rejected'
    created_at: string
}

async function checkAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // We reuse existing profile logic to check admin status
    // Note: This relies on at least one player_profile being admin.
    const { isAdmin } = await getProfilePageData(user.id)
    if (!isAdmin) throw new Error('Forbidden: Admin access only')
    return supabase
}

export async function getPendingVerifications(): Promise<VerificationRequest[]> {
    const supabase = await checkAdmin()

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as VerificationRequest[]
}

export async function verifyUser(userId: string, action: 'verified' | 'rejected') {
    const supabase = await checkAdmin()

    const { error } = await supabase
        .from('profiles')
        .update({ status: action, updated_at: new Date().toISOString() })
        .eq('id', userId)

    if (error) throw error
    revalidatePath('/admin/verifications')
}
