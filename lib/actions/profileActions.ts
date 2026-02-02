'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateContactInfo(contactNumber: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('profiles')
        .update({ contact_number: contactNumber })
        .eq('id', user.id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/ladder')
    revalidatePath('/profile')

    return { success: true }
}

export async function updateCohort(cohortId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('profiles')
        .update({ cohort_id: cohortId })
        .eq('id', user.id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/profile')
    return { success: true }
}
