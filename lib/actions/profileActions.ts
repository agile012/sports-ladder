'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateContactInfo(contactNumber: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('player_profiles')
        .update({ contact_number: contactNumber })
        .eq('user_id', user.id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/ladder')
    revalidatePath('/profile')

    return { success: true }
}
