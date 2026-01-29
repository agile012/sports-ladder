'use client'

import { cn } from '@/lib/utils'
import { Trophy, Target, Circle } from 'lucide-react'

interface FormGuideProps {
    results: Array<{
        result: 'W' | 'L' | 'D'
        opponent?: string
        date?: string
    }>
    showLabels?: boolean
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const sizeClasses = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
}

export function FormGuide({
    results,
    showLabels = false,
    size = 'md',
    className,
}: FormGuideProps) {
    const displayResults = results.slice(0, 5)

    if (displayResults.length === 0) {
        return (
            <div className={cn('flex items-center gap-1', className)}>
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            'rounded-full bg-muted flex items-center justify-center font-bold opacity-30',
                            sizeClasses[size]
                        )}
                    >
                        -
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            {showLabels && (
                <span className="text-xs font-medium text-muted-foreground mr-1">Form:</span>
            )}
            {displayResults.map((match, i) => (
                <div
                    key={i}
                    className={cn(
                        'rounded-full flex items-center justify-center font-bold transition-transform hover:scale-110 cursor-default shadow-sm',
                        sizeClasses[size],
                        match.result === 'W' && 'form-win',
                        match.result === 'L' && 'form-loss',
                        match.result === 'D' && 'form-draw'
                    )}
                    title={
                        match.opponent
                            ? `${match.result === 'W' ? 'Won' : match.result === 'L' ? 'Lost' : 'Drew'} vs ${match.opponent}${match.date ? ` (${match.date})` : ''}`
                            : undefined
                    }
                >
                    {match.result}
                </div>
            ))}
            {/* Pad with empty slots if less than 5 results */}
            {displayResults.length < 5 &&
                [...Array(5 - displayResults.length)].map((_, i) => (
                    <div
                        key={`empty-${i}`}
                        className={cn(
                            'rounded-full bg-muted/50 flex items-center justify-center font-bold opacity-30 border-2 border-dashed border-muted-foreground/20',
                            sizeClasses[size]
                        )}
                    >
                        -
                    </div>
                ))}
        </div>
    )
}

// Compact inline version for leaderboards
interface FormGuideInlineProps {
    wins: number
    losses: number
    total: number
    className?: string
}

export function FormGuideInline({ wins, losses, total, className }: FormGuideInlineProps) {
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {wins}W
                </span>
            </div>
            <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-mono font-bold text-red-500 dark:text-red-400">
                    {losses}L
                </span>
            </div>
            <div className="text-xs font-bold text-muted-foreground">({winRate}%)</div>
        </div>
    )
}
