'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, AreaChart, Area, ReferenceLine } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useMemo } from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Trophy, Flame, AlertTriangle, TrendingUp, TrendingDown, Award, Target } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"

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
        <Card className="col-span-1 md:col-span-2 shadow-sm card-hover">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Matches Per Week</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="label"
                            stroke="#888888"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={20}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            width={30}
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
                            cursor={{ stroke: 'hsl(var(--muted))', strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill="url(#colorCount)"
                        />
                    </AreaChart>
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
        <Card className="col-span-1 shadow-sm card-hover">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Win Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-4">
                {/* Challenger */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-semibold text-foreground flex items-center gap-2">
                            <Target className="h-4 w-4 text-violet-500" />
                            Challenger Wins
                        </span>
                        <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{challengerWins} ({cPct}%)</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-1000 rounded-full"
                            style={{ width: `${cPct}%` }}
                        />
                    </div>
                </div>

                {/* Defender */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-semibold text-foreground flex items-center gap-2">
                            <Award className="h-4 w-4 text-emerald-500" />
                            Defender Wins
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{defenderWins} ({dPct}%)</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-1000 rounded-full"
                            style={{ width: `${dPct}%` }}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// NEW: ELO Distribution Histogram
interface EloDistributionProps {
    data: Array<{ rating_range: string; count: number }>
}

export function EloDistributionChart({ data }: EloDistributionProps) {
    if (!data || data.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                        Rating Distribution
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    No rating data available
                </CardContent>
            </Card>
        )
    }

    const maxCount = Math.max(...data.map(d => d.count))

    return (
        <Card className="shadow-sm card-hover">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Rating Distribution
                </CardTitle>
                <CardDescription>How player ratings are distributed</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barCategoryGap="15%">
                        <XAxis
                            dataKey="rating_range"
                            stroke="#888888"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            width={30}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-3 shadow-lg">
                                            <p className="text-sm font-bold">{label}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {payload[0].value} player{(payload[0].value as number) !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    )
                                }
                                return null
                            }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={`hsl(${200 + (index * 20)}, 70%, ${50 + (entry.count / maxCount) * 20}%)`}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

// NEW: Win Streak Leaders
interface WinStreakItem {
    id: string
    name: string
    avatar?: string
    current_streak: number
    best_streak: number
}

export function WinStreakCard({ data }: { data: WinStreakItem[] | null }) {
    if (!data || data.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Flame className="h-5 w-5 text-orange-500" />
                        Hot Streaks
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    No streak data available
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/10 shadow-sm card-hover">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg">
                        <Flame className="h-5 w-5 text-orange-500" />
                    </div>
                    Hot Streaks
                </CardTitle>
                <CardDescription>Players on fire right now</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {data.slice(0, 5).map((player, i) => (
                    <Link
                        key={player.id}
                        href={`/player/${player.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-background/50 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-muted-foreground w-4">
                                {i + 1}
                            </span>
                            <Avatar className="h-8 w-8 border group-hover:ring-2 ring-orange-500/30 transition-all">
                                <AvatarImage src={player.avatar} />
                                <AvatarFallback>{player.name?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-sm group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                {player.name || 'Unknown'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="flex items-center gap-1">
                                    <Flame className="h-3 w-3 text-orange-500 animate-pulse-subtle" />
                                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                        {player.current_streak}W
                                    </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                    Best: {player.best_streak}
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </CardContent>
        </Card>
    )
}

// NEW: Upset Alerts - Lower ranked beating higher ranked
interface UpsetItem {
    id: string
    winner_id: string
    winner_name: string
    winner_avatar?: string
    winner_rank: number
    loser_name: string
    loser_avatar?: string
    loser_rank: number
    rank_difference: number
    date: string
}

export function UpsetAlertsCard({ data }: { data: UpsetItem[] | null }) {
    if (!data || data.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Upset Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    No recent upsets
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/10 shadow-sm card-hover">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                    Upset Alerts
                </CardTitle>
                <CardDescription>Lower-ranked players defeating higher-ranked opponents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {data.slice(0, 5).map((upset, i) => (
                    <div
                        key={upset.id || i}
                        className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-amber-500/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                                    Winner
                                </span>
                                <Avatar className="h-8 w-8 border-2 border-amber-500/30">
                                    <AvatarImage src={upset.winner_avatar} />
                                    <AvatarFallback>{upset.winner_name?.[0] || '?'}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    #{upset.winner_rank}
                                </span>
                            </div>
                            <div className="text-center px-2">
                                <TrendingUp className="h-4 w-4 text-amber-500 mx-auto" />
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    +{upset.rank_difference}
                                </span>
                            </div>
                            <div className="flex flex-col items-center opacity-60">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Loser
                                </span>
                                <Avatar className="h-8 w-8 border">
                                    <AvatarImage src={upset.loser_avatar} />
                                    <AvatarFallback>{upset.loser_name?.[0] || '?'}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    #{upset.loser_rank}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold">{upset.winner_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                                beat {upset.loser_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {format(new Date(upset.date), 'MMM d')}
                            </p>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

// NEW: Active Players Stat
export function ActivePlayersChart({ totalPlayers, activePlayers }: { totalPlayers: number, activePlayers: number }) {
    const activePercentage = totalPlayers > 0 ? Math.round((activePlayers / totalPlayers) * 100) : 0

    return (
        <Card className="shadow-sm card-hover">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    Player Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="flex items-center justify-center">
                    <div className="relative">
                        <svg className="h-32 w-32 transform -rotate-90">
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                className="text-muted/30"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray={`${(activePercentage / 100) * 352} 352`}
                                strokeLinecap="round"
                                className="text-emerald-500 transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black">{activePercentage}%</span>
                            <span className="text-xs text-muted-foreground">Active</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between mt-4 text-sm">
                    <div className="text-center">
                        <p className="font-bold text-lg">{activePlayers}</p>
                        <p className="text-xs text-muted-foreground">Active Players</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg">{totalPlayers}</p>
                        <p className="text-xs text-muted-foreground">Total Players</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

