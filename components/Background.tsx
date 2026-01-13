'use client'

import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function Background() {
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme } = useTheme()

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const isDark = resolvedTheme === 'dark'

    return (
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none select-none">
            <div className="absolute inset-0 bg-background" />

            {/* Subtle Monochrome Depth (Shades) */}
            <div
                className="absolute inset-0"
                style={{
                    background: isDark
                        ? 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 70%)'
                        : 'radial-gradient(circle at 50% 0%, rgba(0,0,0,0.08) 0%, transparent 70%)'
                }}
            />

        </div>
    )
}
