'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, LineChart, Line, Area, AreaChart } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMemo } from "react"
import { format } from "date-fns"

export function MatchesPerWeekChart({ data }: { data: any[] }) {
    const chartData = useMemo(() => {
        if (!data) return []
        return data.map(d => ({
            date: new Date(d.week_start),
            count: Number(d.count),
            label: format(new Date(d.week_start), 'MMM d')
        }))
    }, [data])

    if (!chartData.length) return null

    return (
        <Card className="col-span-1 md:col-span-2 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Matches Per Week</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <XAxis
                            dataKey="label"
                            stroke="#888888"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={20}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                        Week
                                                    </span>
                                                    <span className="font-bold text-muted-foreground">
                                                        {label}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                        Matches
                                                    </span>
                                                    <span className="font-bold text-foreground">
                                                        {payload[0].value}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            }}
                            cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                        />
                        <Bar dataKey="count" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary/80 hover:fill-primary" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

export function WinDistributionChart({ challengerWins, defenderWins }: { challengerWins: number, defenderWins: number }) {
    const total = challengerWins + defenderWins
    const cPct = total ? Math.round((challengerWins / total) * 100) : 0
    const dPct = total ? Math.round((defenderWins / total) * 100) : 0

    return (
        <Card className="col-span-1 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Win Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-4">
                {/* Challenger */}
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="font-semibold text-foreground">Challenger Wins</span>
                        <span className="font-mono font-bold text-primary">{cPct}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${cPct}%` }} />
                    </div>
                </div>

                {/* Defender */}
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="font-semibold text-foreground">Defender Wins</span>
                        <span className="font-mono font-bold text-emerald-500">{dPct}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${dPct}%` }} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
