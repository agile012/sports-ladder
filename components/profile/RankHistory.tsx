
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts'
import { RankHistoryItem } from '@/lib/types'

export default function RankHistory({ rankHistory }: { rankHistory: RankHistoryItem[] | undefined }) {
    if (!rankHistory || rankHistory.length === 0) return (
        <Card className="flex items-center justify-center p-8 text-muted-foreground bg-muted/20 border-dashed">
            No rank history available yet.
        </Card>
    )

    const data = rankHistory.map(h => ({
        date: new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        fullDate: new Date(h.created_at).toLocaleDateString(),
        rank: h.new_rank,
        reason: h.reason
    })).reverse() // Chronological

    // For rank, lower is better. We want the Y axis to invert.
    const minRank = Math.min(...data.map(d => d.rank))
    const maxRank = Math.max(...data.map(d => d.rank))

    return (
        <Card className="border shadow-none bg-transparent">
            <CardContent className="p-0">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRank" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                            <XAxis
                                dataKey="date"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                reversed={true} // Rank 1 at top
                                domain={[Math.max(1, minRank - 1), maxRank + 1]}
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            Rank
                                                        </span>
                                                        <span className="font-bold text-muted-foreground">
                                                            #{payload[0].value}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            Date
                                                        </span>
                                                        <span className="font-bold text-muted-foreground">
                                                            {payload[0].payload.fullDate}
                                                        </span>
                                                    </div>
                                                    {payload[0].payload.reason && (
                                                        <div className="col-span-2 flex flex-col pt-1 border-t">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                Reason
                                                            </span>
                                                            <span className="text-xs font-medium">
                                                                {payload[0].payload.reason}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Area
                                type="stepAfter" // Rank changes are stepped usually, or monotone? Step is more accurate for sudden jumps
                                dataKey="rank"
                                stroke="#f59e0b" // Amber/Yellow for Rank
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorRank)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
