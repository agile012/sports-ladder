'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

export default function PWAPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault()
            setDeferredPrompt(e)
            // Check if user has dismissed it recently
            const dismissed = localStorage.getItem('pwa_prompt_dismissed')
            if (!dismissed) {
                setIsVisible(true)
            }
        }

        window.addEventListener('beforeinstallprompt', handler)

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            setDeferredPrompt(null)
            setIsVisible(false)
        }
    }

    const handleDismiss = () => {
        setIsVisible(false)
        // Dismiss for 7 days
        localStorage.setItem('pwa_prompt_dismissed', Date.now().toString())
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 pointer-events-none"
                >
                    <div className="bg-background/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 pointer-events-auto">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-xl text-primary">
                                <Download className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">Install App</h4>
                                <p className="text-xs text-muted-foreground">Add to Home Screen for better experience</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleInstall} className="rounded-full shadow-lg shadow-primary/20">
                                Install
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={handleDismiss}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
