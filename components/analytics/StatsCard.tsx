'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatsCardProps {
    title: string
    value: number | string
    previousValue?: number
    format?: 'number' | 'percentage' | 'currency'
    icon?: React.ReactNode
    colorScheme?: 'default' | 'amber' | 'emerald' | 'violet' | 'blue'
    animate?: boolean
    className?: string
}

const colorSchemes = {
    default: {
        bg: 'bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20',
        border: 'border-primary/20',
        icon: 'text-primary',
        iconBg: 'bg-primary/10',
    },
    amber: {
        bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
        border: 'border-amber-200 dark:border-amber-800/50',
        icon: 'text-amber-600 dark:text-amber-400',
        iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    },
    emerald: {
        bg: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        icon: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    },
    violet: {
        bg: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30',
        border: 'border-violet-200 dark:border-violet-800/50',
        icon: 'text-violet-600 dark:text-violet-400',
        iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    },
    blue: {
        bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
        border: 'border-blue-200 dark:border-blue-800/50',
        icon: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    },
}

export function StatsCard({
    title,
    value,
    previousValue,
    format = 'number',
    icon,
    colorScheme = 'default',
    animate = true,
    className,
}: StatsCardProps) {
    const [displayValue, setDisplayValue] = useState(animate ? 0 : value)
    const [hasAnimated, setHasAnimated] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)

    const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0
    const colors = colorSchemes[colorScheme]

    // Calculate trend
    const trend = previousValue !== undefined
        ? numericValue > previousValue
            ? 'up'
            : numericValue < previousValue
                ? 'down'
                : 'neutral'
        : null

    const trendPercentage = previousValue !== undefined && previousValue !== 0
        ? Math.abs(((numericValue - previousValue) / previousValue) * 100).toFixed(1)
        : null

    // Animate number counting up
    useEffect(() => {
        if (!animate || hasAnimated || typeof value !== 'number') return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setHasAnimated(true)
                    const duration = 1000
                    const startTime = Date.now()
                    const startValue = 0

                    const animateValue = () => {
                        const elapsed = Date.now() - startTime
                        const progress = Math.min(elapsed / duration, 1)
                        const easeOut = 1 - Math.pow(1 - progress, 3) // easeOutCubic
                        const current = Math.floor(startValue + (numericValue - startValue) * easeOut)
                        setDisplayValue(current)

                        if (progress < 1) {
                            requestAnimationFrame(animateValue)
                        } else {
                            setDisplayValue(numericValue)
                        }
                    }

                    requestAnimationFrame(animateValue)
                }
            },
            { threshold: 0.5 }
        )

        if (cardRef.current) {
            observer.observe(cardRef.current)
        }

        return () => observer.disconnect()
    }, [animate, hasAnimated, numericValue, value])

    const formatValue = (val: number | string) => {
        if (typeof val === 'string') return val
        switch (format) {
            case 'percentage':
                return `${val}%`
            case 'currency':
                return `$${val.toLocaleString()}`
            default:
                return val.toLocaleString()
        }
    }

    return (
        <div
            ref={cardRef}
            className={cn(
                'relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:shadow-lg',
                colors.bg,
                colors.border,
                'card-hover',
                className
            )}
        >
            {/* Background icon decoration */}
            {icon && (
                <div className="absolute -right-4 -top-4 opacity-[0.07]">
                    <div className="h-24 w-24 flex items-center justify-center">
                        {icon}
                    </div>
                </div>
            )}

            <div className="relative z-10 flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {title}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black tracking-tight">
                            {formatValue(typeof value === 'number' ? displayValue : value)}
                        </span>
                        {trend && trendPercentage && (
                            <span
                                className={cn(
                                    'flex items-center gap-0.5 text-xs font-bold',
                                    trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
                                    trend === 'down' && 'text-red-500 dark:text-red-400',
                                    trend === 'neutral' && 'text-muted-foreground'
                                )}
                            >
                                {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                                {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                                {trend === 'neutral' && <Minus className="h-3 w-3" />}
                                {trendPercentage}%
                            </span>
                        )}
                    </div>
                </div>

                {icon && (
                    <div className={cn('rounded-lg p-2', colors.iconBg)}>
                        <div className={cn('h-5 w-5', colors.icon)}>{icon}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
