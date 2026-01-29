'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { format, subMonths, eachDayOfInterval, startOfMonth, endOfMonth, getDay, differenceInWeeks } from 'date-fns'

interface ActivityHeatmapProps {
    data: Array<{
        date: string // ISO date string
        count: number
    }>
    months?: number
    title?: string
    className?: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function ActivityHeatmap({
    data,
    months = 6,
    title = 'Activity',
    className,
}: ActivityHeatmapProps) {
    const { grid, maxCount, monthLabels } = useMemo(() => {
        const endDate = new Date()
        const startDate = subMonths(endDate, months)

        // Create a map of date -> count
        const countMap = new Map(
            data.map((d) => [format(new Date(d.date), 'yyyy-MM-dd'), d.count])
        )

        // Generate all days in the range
        const days = eachDayOfInterval({ start: startDate, end: endDate })

        // Find max count for color scaling
        const maxCount = Math.max(...data.map((d) => d.count), 1)

        // Group by week columns
        const weeks: Array<Array<{ date: Date; count: number; dayOfWeek: number }>> = []
        let currentWeek: Array<{ date: Date; count: number; dayOfWeek: number }> = []

        days.forEach((day) => {
            const dayOfWeek = getDay(day)
            const dateStr = format(day, 'yyyy-MM-dd')
            const count = countMap.get(dateStr) || 0

            if (dayOfWeek === 0 && currentWeek.length > 0) {
                weeks.push(currentWeek)
                currentWeek = []
            }

            currentWeek.push({ date: day, count, dayOfWeek })
        })

        if (currentWeek.length > 0) {
            weeks.push(currentWeek)
        }

        // Generate month labels
        const monthLabels: Array<{ label: string; weekIndex: number }> = []
        let lastMonth = -1
        weeks.forEach((week, weekIndex) => {
            const firstDayOfWeek = week[0]
            const month = firstDayOfWeek.date.getMonth()
            if (month !== lastMonth) {
                monthLabels.push({
                    label: format(firstDayOfWeek.date, 'MMM'),
                    weekIndex,
                })
                lastMonth = month
            }
        })

        return { grid: weeks, maxCount, monthLabels }
    }, [data, months])

    const getIntensity = (count: number): string => {
        if (count === 0) return 'bg-muted/50'
        const intensity = count / maxCount
        if (intensity <= 0.25) return 'bg-emerald-200 dark:bg-emerald-900'
        if (intensity <= 0.5) return 'bg-emerald-400 dark:bg-emerald-700'
        if (intensity <= 0.75) return 'bg-emerald-500 dark:bg-emerald-500'
        return 'bg-emerald-600 dark:bg-emerald-400'
    }

    if (grid.length === 0) {
        return (
            <Card className={cn('', className)}>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No activity data available
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn('overflow-hidden', className)}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    {/* Month labels */}
                    <div className="flex mb-2 ml-8">
                        {monthLabels.map((m, i) => (
                            <div
                                key={i}
                                className="text-xs text-muted-foreground font-medium"
                                style={{
                                    width: `${((monthLabels[i + 1]?.weekIndex || grid.length) - m.weekIndex) * 14}px`,
                                }}
                            >
                                {m.label}
                            </div>
                        ))}
                    </div>

                    <div className="flex">
                        {/* Day labels */}
                        <div className="flex flex-col gap-[2px] mr-2 text-[10px] text-muted-foreground">
                            {WEEKDAYS.map((day, i) => (
                                <div
                                    key={day}
                                    className="h-3 flex items-center"
                                    style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Heatmap grid */}
                        <div className="flex gap-[2px]">
                            {grid.map((week, weekIndex) => (
                                <div key={weekIndex} className="flex flex-col gap-[2px]">
                                    {/* Pad beginning of first week if needed */}
                                    {weekIndex === 0 &&
                                        [...Array(week[0].dayOfWeek)].map((_, i) => (
                                            <div key={`pad-${i}`} className="h-3 w-3 rounded-sm" />
                                        ))}
                                    {week.map((day, dayIndex) => (
                                        <div
                                            key={dayIndex}
                                            className={cn(
                                                'h-3 w-3 rounded-sm transition-colors hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 cursor-default',
                                                getIntensity(day.count)
                                            )}
                                            title={`${format(day.date, 'MMM d, yyyy')}: ${day.count} ${day.count === 1 ? 'match' : 'matches'}`}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                        <span>Less</span>
                        <div className="flex gap-1">
                            <div className="h-3 w-3 rounded-sm bg-muted/50" />
                            <div className="h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
                            <div className="h-3 w-3 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
                            <div className="h-3 w-3 rounded-sm bg-emerald-500 dark:bg-emerald-500" />
                            <div className="h-3 w-3 rounded-sm bg-emerald-600 dark:bg-emerald-400" />
                        </div>
                        <span>More</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
