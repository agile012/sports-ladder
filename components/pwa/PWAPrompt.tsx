'use client'

import { useState, useEffect } from 'react'
import { X, Download, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from "sonner"

type PromptType = 'install' | 'notification' | null

export default function PWAPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [promptType, setPromptType] = useState<PromptType>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // 1. Setup PWA Install Listener
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault()
            setDeferredPrompt(e)
            checkQueues('install')
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        // 2. Check for Notifications if PWA not immediately triggered or after a delay
        // We give a small delay to allow PWA event to fire if it's going to
        const timer = setTimeout(() => {
            if (!promptType) {
                checkQueues('notification')
            }
        }, 3000)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
            clearTimeout(timer)
        }
    }, [])

    const checkQueues = (triggerType?: PromptType) => {
        // Priority 1: PWA Install
        // Only show if we have the event AND it hasn't been dismissed recently
        const installDismissed = localStorage.getItem('pwa_prompt_dismissed')
        // We can't check deferredPrompt here directly if called from effect, so we rely on the trigger
        // If trigger is 'install', we know we have the event.
        if (triggerType === 'install' && !installDismissed) {
            setPromptType('install')
            setIsVisible(true)
            return
        }

        // Priority 2: Notifications
        // Only show if permission is 'default' (not granted or denied) AND not dismissed
        const notifDismissed = localStorage.getItem('notification_prompt_dismissed')
        if ('Notification' in window && Notification.permission === 'default' && !notifDismissed) {
            // If we are currently showing install, don't override
            // We'll check again after install is handled
            if (triggerType === 'install' && !installDismissed) return

            setPromptType('notification')
            setIsVisible(true)
            return
        }
    }

    const handleInstall = async () => {
        if (!deferredPrompt) return

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            setDeferredPrompt(null)
            dismiss('install')
        }
    }

    const handleEnableNotifications = async () => {
        try {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
                const registration = await navigator.serviceWorker.ready
                const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

                if (!vapidPublicKey) {
                    console.error("VAPID Public Key not found")
                    return
                }

                // Import dynamically to avoid SSR issues if utils uses window
                const { urlBase64ToUint8Array } = await import('@/lib/utils')

                const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                })

                // Send subscription to server
                const res = await fetch('/api/push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription)
                })

                if (!res.ok) throw new Error(await res.text())

                toast.success("Notifications enabled!")
            } else {
                toast.info("Notifications blocked.")
            }
        } catch (error: any) {
            console.error("Error enabling notifications:", error)
            toast.error("Failed to enable notifications")
        } finally {
            dismiss('notification')
        }
    }

    const dismiss = (type: PromptType) => {
        setIsVisible(false)
        const key = type === 'install' ? 'pwa_prompt_dismissed' : 'notification_prompt_dismissed'
        // Dismiss for 7 days
        localStorage.setItem(key, Date.now().toString())

        // If we just handled install (or dismissed it), check if we should show notifications next
        if (type === 'install') {
            setTimeout(() => {
                checkQueues('notification')
            }, 1000)
        } else {
            setPromptType(null)
        }
    }

    if (!isVisible || !promptType) return null

    const content = {
        install: {
            icon: <Download className="w-5 h-5" />,
            title: "Install App",
            description: "Add to Home Screen for a better experience",
            action: "Install",
            onAction: handleInstall,
            color: "text-primary bg-primary/20"
        },
        notification: {
            icon: <Bell className="w-5 h-5" />,
            title: "Enable Notifications",
            description: "Stay updated on challenges and match results",
            action: "Enable",
            onAction: handleEnableNotifications,
            color: "text-amber-600 bg-amber-500/20"
        }
    }[promptType]

    return (
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div
                    key={promptType}
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 pointer-events-none"
                >
                    <div className="bg-background/80 backdrop-blur-xl border border-border/50 p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4 pointer-events-auto ring-1 ring-black/5">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${content.color}`}>
                                {content.icon}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">{content.title}</h4>
                                <p className="text-xs text-muted-foreground">{content.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={content.onAction} className="rounded-full shadow-lg h-8 md:h-9 text-xs md:text-sm">
                                {content.action}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => dismiss(promptType)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
