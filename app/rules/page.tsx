import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Info, Settings, Trophy, AlertCircle, Clock, ShieldAlert, PauseCircle } from 'lucide-react'
import { ScoringConfig, Sport } from '@/lib/types'

export default async function RulesPage() {
    const supabase = await createClient()
    const { data: sports } = await supabase.from('sports').select('*').order('name')

    if (!sports || sports.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No sports configured.</div>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Rules & Configuration</h1>
                <p className="text-muted-foreground">
                    Understand the scoring rules, timelines, and penalties for each sport ladder.
                </p>
            </div>

            <Tabs defaultValue={sports[0].id} className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 mb-6 justify-start">
                    {sports.map((s: Sport) => (
                        <TabsTrigger
                            key={s.id}
                            value={s.id}
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-background"
                        >
                            {s.name}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {sports.map((s: Sport) => {
                    const config = s.scoring_config || {} as ScoringConfig
                    return (
                        <TabsContent key={s.id} value={s.id} className="space-y-6">
                            {s.is_paused && (
                                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-4 rounded-lg flex items-start gap-3">
                                    <PauseCircle className="h-5 w-5 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="font-semibold">Ladder Paused</h4>
                                        <p className="text-sm opacity-90">This ladder is currently paused. No new matches can be challenged, and penalties are suspended.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-6 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Trophy className="h-5 w-5 text-primary" />
                                            Scoring Format
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm font-medium">Type</span>
                                            <Badge variant="outline" className="capitalize">{config.type || 'Simple'}</Badge>
                                        </div>
                                        {config.type === 'sets' && (
                                            <>
                                                <div className="flex justify-between items-center py-2 border-b">
                                                    <span className="text-sm text-muted-foreground">Total Sets</span>
                                                    <span className="font-mono">{config.total_sets || 3}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b">
                                                    <span className="text-sm text-muted-foreground">Points per Set</span>
                                                    <span className="font-mono">{config.points_per_set || 11}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b">
                                                    <span className="text-sm text-muted-foreground">Win by</span>
                                                    <span className="font-mono">{config.win_by || 2}</span>
                                                </div>
                                                {config.cap && (
                                                    <div className="flex justify-between items-center py-2 border-b">
                                                        <span className="text-sm text-muted-foreground">Cap (Sudden Death)</span>
                                                        <span className="font-mono">{config.cap}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Settings className="h-5 w-5 text-primary" />
                                            Challenge Rules
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm text-muted-foreground">Max Range (Above)</span>
                                            <span className="font-mono">{config.max_challenge_range ?? 'Unlimited'}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm text-muted-foreground">Max Range (Below)</span>
                                            <span className="font-mono">{config.max_challenge_below ?? 'Unlimited'}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm text-muted-foreground">Rematch Cooldown</span>
                                            <span className="font-mono">{config.rematch_cooldown_days ?? 7} days</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-primary" />
                                            Timelines
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">To Play Match</span>
                                                <span className="text-xs text-muted-foreground">Time to play after challenge accepted</span>
                                            </div>
                                            <Badge variant="secondary">{config.challenge_window_days ?? 7} days</Badge>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">Auto-Verify</span>
                                                <span className="text-xs text-muted-foreground">Time before result is auto-confirmed</span>
                                            </div>
                                            <Badge variant="secondary">{config.auto_verify_window_days ?? 3} days</Badge>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-red-200 dark:border-red-900/50 bg-red-50/10 dark:bg-red-900/10">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                            <ShieldAlert className="h-5 w-5" />
                                            Penalties & Removal
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between items-center py-2 border-b border-red-200/50 dark:border-red-800/50">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">Inactivity Penalty</span>
                                                <span className="text-xs text-muted-foreground">Days without playing causes rank drop</span>
                                            </div>
                                            <span className="font-mono font-bold text-red-600 dark:text-red-400">{config.penalty_days ?? 14} days</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-red-200/50 dark:border-red-800/50">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">Auto Removal</span>
                                                <span className="text-xs text-muted-foreground">Days inactive before removal from ladder</span>
                                            </div>
                                            <span className="font-mono font-bold text-red-600 dark:text-red-400">{config.removal_days ?? 42} days</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    )
                })}
            </Tabs>
        </div>
    )
}
