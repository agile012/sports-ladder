import { getSportAnalytics } from "@/lib/actions/analytics"
import { LeaderboardCard } from "@/components/analytics/LeaderboardCard"
import { RivalryCard } from "@/components/analytics/RivalryCard"
import { MatchesPerWeekChart, WinDistributionChart } from "@/components/analytics/AnalyticsCharts"
import { Crown, ShieldCheck, TrendingUp, Zap, Skull, Crosshair } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

// Cache this page for 5 minutes to reduce DB load
export const revalidate = 300

export default async function AnalyticsPage({ params }: { params: { sportId: string } }) {
    const { sportId } = await params as { sportId: string }
    const supabase = await createClient()

    // Fetch Sport Name
    const { data: sport } = await supabase.from('sports').select('name').eq('id', sportId).single()
    const sportName = sport?.name || 'Sport'

    const data = await getSportAnalytics(sportId) as any

    const overview = data.overview
    const leaders = data.leaderboards
    const rivalries = data.rivalries

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        {sportName} Analytics
                    </span>
                </h1>
                <p className="text-muted-foreground text-lg">Detailed performance metrics and historical archives.</p>
            </div>

            {/* League Pulse */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight border-b pb-2">League Pulse</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Big Stats */}
                    <Card className="bg-primary/5 border-primary/20 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 -mt-4 -mr-4 opacity-[0.05] transition-opacity group-hover:opacity-10">
                            <Zap className="w-32 h-32 text-primary" />
                        </div>
                        <CardContent className="flex flex-col items-center justify-center h-full py-8 relative z-10">
                            <span className="text-6xl md:text-7xl font-black text-foreground tracking-tighter">{overview.total_matches}</span>
                            <span className="text-xs md:text-sm font-bold uppercase tracking-widest text-primary/80 mt-2">Matches Played</span>
                        </CardContent>
                    </Card>

                    <WinDistributionChart challengerWins={overview.challenger_wins} defenderWins={overview.defender_wins} />
                    <MatchesPerWeekChart data={overview.matches_per_week} />
                </div>
            </section>

            {/* Hall of Fame */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight border-b pb-2">Hall of Fame</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Rivalries */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight border-b pb-2">Rivalries</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RivalryCard data={rivalries} />
                </div>
            </section>
        </div>
    )
}
