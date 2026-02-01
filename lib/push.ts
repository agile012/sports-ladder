import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

// Configure web-push
if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys are missing. Push notifications will not work.')
} else {
    webpush.setVapidDetails(
        `mailto:${process.env.FROM_EMAIL || 'admin@example.com'}`,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )
}

interface PushPayload {
    title: string
    body: string
    url?: string
    icon?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
    const supabase = await createClient()

    // Fetch all subscriptions for the user
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId)

    if (!subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0

    const notifications = subscriptions.map(async (record) => {
        try {
            await webpush.sendNotification(
                record.subscription,
                JSON.stringify(payload)
            )
            sent++
        } catch (error: any) {
            console.error('Error sending push notification:', error)
            failed++

            // If subscription is invalid (410 Gone), delete it
            if (error.statusCode === 410 || error.statusCode === 404) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', userId)
                    .eq('subscription->>endpoint', record.subscription.endpoint)
            }
        }
    })

    await Promise.all(notifications)
    return { sent, failed }
}
