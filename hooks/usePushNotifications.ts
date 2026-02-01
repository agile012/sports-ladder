import { useState, useEffect } from 'react'

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            registerServiceWorker()
        } else {
            setLoading(false)
        }
    }, [])

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)
        } catch (error) {
            console.error('Error getting subscription', error)
        } finally {
            setLoading(false)
        }
    }

    const subscribe = async () => {
        setLoading(true)
        try {
            const registration = await navigator.serviceWorker.ready
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

            if (!vapidKey) {
                throw new Error('VAPID public key not found')
            }

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })

            // Send subscription to backend
            await fetch('/api/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub),
            })

            setSubscription(sub)
            return true
        } catch (error) {
            console.error('Error subscribing', error)
            return false
        } finally {
            setLoading(false)
        }
    }

    const unsubscribe = async () => {
        if (!subscription) return

        setLoading(true)
        try {
            await subscription.unsubscribe()

            // Remove from backend
            await fetch('/api/push', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint }),
            })

            setSubscription(null)
        } catch (error) {
            console.error('Error unsubscribing', error)
        } finally {
            setLoading(false)
        }
    }

    return {
        isSupported,
        subscription,
        subscribe,
        unsubscribe,
        loading
    }
}
