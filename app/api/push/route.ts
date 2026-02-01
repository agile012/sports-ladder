import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await req.json()

    // Validate subscription
    if (!subscription || !subscription.endpoint) {
        return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: user.id,
            subscription
        }, { onConflict: 'user_id, subscription' })

    if (error) {
        console.error('Error saving subscription:', error)
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint } = await req.json()

    if (!endpoint) {
        return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
    }

    // We need to match based on the endpoint within the JSONB column
    // This might be tricky with simple equality if the stored JSON structure varies
    // Ideally, subscription is the exact object.
    // Usage: .eq('subscription->>endpoint', endpoint)

    const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('subscription->>endpoint', endpoint)

    if (error) {
        console.error('Error removing subscription:', error)
        return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
