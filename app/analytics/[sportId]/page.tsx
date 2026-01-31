import { getSportAnalytics } from "@/lib/actions/analytics"
import { LeaderboardCard } from "@/components/analytics/LeaderboardCard"
import { RivalryCard } from "@/components/analytics/RivalryCard"
import { MatchesPerWeekChart, WinDistributionChart, ActivePlayersChart, EloDistributionChart } from "@/components/analytics/AnalyticsCharts"
import { StatsCard } from "@/components/analytics/StatsCard"
import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap"
import { Crown, ShieldCheck, TrendingUp, Zap, Skull, Crosshair, Trophy, Users, Target, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

// Cache this page for 5 minutes to reduce DB load
export const revalidate = 300

export default async function AnalyticsPage({ params }: { params: Promise<{ sportId: string }> }) {
    const { sportId } = await params as { sportId: string }
    const supabase = await createClient()

    // Fetch Sport Name
    const { data: sport } = await supabase.from('sports').select('name').eq('id', sportId).single()
    const sportName = sport?.name || 'Sport'

    const data = await getSportAnalytics(sportId) as any

    const overview = data.overview
    const leaders = data.leaderboards
    const rivalries = data.rivalries

    // Calculate additional stats
    const totalPlayers = overview.total_players || 0
    const activePlayers = overview.active_players || Math.round(totalPlayers * 0.7)
    const avgMatchesPerPlayer = totalPlayers > 0
        ? Math.round((overview.total_matches * 2) / totalPlayers)
        : 0

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Enhanced Header */}
            <div className="relative overflow-hidden rounded-2xl border bg-card">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-violet-500/10" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative py-8 px-6 md:px-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    <Activity className="w-5 h-5 text-emerald-500" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Analytics Dashboard
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                                <span className="text-foreground">{sportName}</span>
                                <span className="text-muted-foreground font-medium ml-2">Stats</span>
                            </h1>
                            <p className="text-muted-foreground text-sm md:text-base max-w-xl">
                                Performance metrics, historical trends, and competitive insights for the {sportName} ladder.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <div className="text-center p-4 rounded-xl bg-background/60 backdrop-blur-sm border">
                                <div className="text-2xl font-black text-emerald-500">{overview.total_matches || 0}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide">Matches</div>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-background/60 backdrop-blur-sm border">
                                <div className="text-2xl font-black text-violet-500">{totalPlayers}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide">Players</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats - Enhanced Grid */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        League Pulse
                    </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Matches"
                        value={overview.total_matches || 0}
                        icon={<Trophy className="h-8 w-8" />}
                        colorScheme="violet"
                        animate={true}
                    />
                    <StatsCard
                        title="Total Players"
                        value={totalPlayers}
                        icon={<Users className="h-8 w-8" />}
                        colorScheme="emerald"
                        animate={true}
                    />
                    <StatsCard
                        title="Challenger Wins"
                        value={overview.challenger_wins || 0}
                        icon={<Target className="h-8 w-8" />}
                        colorScheme="amber"
                        animate={true}
                    />
                    <StatsCard
                        title="Avg Matches/Player"
                        value={avgMatchesPerPlayer}
                        icon={<Activity className="h-8 w-8" />}
                        colorScheme="blue"
                        animate={true}
                    />
                </div>
            </section>

            {/* Charts Section */}
            <section className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart - Matches Over Time */}
                    <div className="lg:col-span-2">
                        <MatchesPerWeekChart data={overview.matches_per_week} />
                    </div>

                    {/* Win Distribution */}
                    <div>
                        <WinDistributionChart
                            challengerWins={overview.challenger_wins}
                            defenderWins={overview.defender_wins}
                        />
                    </div>
                </div>
            </section>

            {/* Player Activity & Rating Distribution */}
            <section className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ActivePlayersChart
                        totalPlayers={totalPlayers}
                        activePlayers={activePlayers}
                    />
                    <EloDistributionChart
                        data={overview.rating_distribution || []}
                    />
                </div>
            </section>

            {/* Hall of Fame - Enhanced Grid */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-xl">
                        <Crown className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Hall of Fame</h2>
                        <p className="text-sm text-muted-foreground">Celebrating the best performers</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <LeaderboardCard
                        title="The Workhorse"
                        subtitle="Most Matches Played"
                        icon={<Zap className="w-5 h-5" />}
                        data={leaders.workhorse?.map((d: any) => ({
                            id: d.id,
                            name: d.name || 'Unknown',
                            avatar: d.avatar,
                            value: d.matches_count
                        }))}
                        valueLabel="Matches"
                    />

                    <LeaderboardCard
                        title="Flawless Victor"
                        subtitle="Highest Win % (Min 5)"
                        icon={<Crown className="w-5 h-5" />}
                        data={leaders.flawless?.map((d: any) => ({
                            id: d.id,
                            name: d.name || 'Unknown',
                            avatar: d.avatar,
                            value: d.win_pct + '%',
                            subValue: `${d.wins}/${d.total_matches} Won`
                        }))}
                        valueLabel="Win %"
                    />

                    <LeaderboardCard
                        title="The Fortress"
                        subtitle="Best Defense Rate (Min 5)"
                        icon={<ShieldCheck className="w-5 h-5" />}
                        data={leaders.fortress?.map((d: any) => ({
                            id: d.id,
                            name: d.name || 'Unknown',
                            avatar: d.avatar,
                            value: d.defense_pct + '%',
                            subValue: `${d.defense_wins}/${d.total_defenses} Defended`
                        }))}
                        valueLabel="Def %"
                    />

                    <LeaderboardCard
                        title="Skyrocketing"
                        subtitle="Biggest Rank Jump"
                        icon={<TrendingUp className="w-5 h-5" />}
                        data={leaders.skyrocketing?.map((d: any) => ({
                            id: d.id,
                            name: d.name || 'Unknown',
                            avatar: d.avatar,
                            value: '+' + d.jump_size,
                            subValue: `Rank ${d.old_rank} -> ${d.new_rank}`
                        }))}
                        valueLabel="Jump"
                    />

                    <LeaderboardCard
                        title="Aggressor-in-Chief"
                        subtitle="Most Challenges Issued"
                        icon={<Crosshair className="w-5 h-5" />}
                        data={leaders.aggressor?.map((d: any) => ({
                            id: d.id,
                            name: d.name || 'Unknown',
                            avatar: d.avatar,
                            value: d.challenges_issued
                        }))}
                        valueLabel="Challenges"
                    />

                    <LeaderboardCard
                        title="Most Wanted"
                        subtitle="Most Challenges Received"
                        icon={<Skull className="w-5 h-5" />}
                        data={leaders.wanted?.map((d: any) => ({
                            id: d.id,
                            name: d.name || 'Unknown',
                            avatar: d.avatar,
                            value: d.challenges_received
                        }))}
                        valueLabel="Challenges"
                    />
                </div>
            </section>

            {/* Rivalries - Enhanced Section */}
            {rivalries && rivalries.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-xl">
                            <Crosshair className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Epic Rivalries</h2>
                            <p className="text-sm text-muted-foreground">Head-to-head battles that define the ladder</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <RivalryCard data={rivalries} />
                    </div>
                </section>
            )}
        </div>
    )
}

