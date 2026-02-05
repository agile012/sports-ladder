'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase/client'
import { Sport, ScoringConfig } from '@/lib/types'
import {
    BookOpen,
    Trophy,
    Calendar,
    ShieldAlert,
    Swords,
    Target,
    Clock,
    ArrowUpCircle,
    FileText,
    Info,
    Gavel
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RulesPage() {
    const [sports, setSports] = useState<Sport[]>([])
    const [activeTab, setActiveTab] = useState('general')

    useEffect(() => {
        const fetchSports = async () => {
            const { data } = await supabase.from('sports').select('*').order('name')
            if (data) setSports(data as Sport[])
        }
        fetchSports()
    }, [])

    return (
        <div className="min-h-screen pb-24 relative overflow-hidden">
            {/* Background Mesh */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 space-y-12">
                {/* Hero Section */}
                <div className="text-center space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-wide uppercase mb-4"
                    >
                        <BookOpen className="w-4 h-4" /> Official Rulebook
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-black tracking-tight"
                    >
                        How to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">Compete</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
                    >
                        Detailed guidelines on scoring, rankings, and fair play. Select a sport to see specific regulations.
                    </motion.p>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    <div className="flex justify-center w-full">
                        <TabsList className="h-12 w-full justify-start overflow-x-auto no-scrollbar bg-transparent p-0 gap-2 md:h-auto md:w-auto md:flex-wrap md:justify-center md:bg-background/50 md:backdrop-blur-md md:border md:border-white/10 md:rounded-full md:p-1.5 md:gap-2">
                            <TabsTrigger
                                value="general"
                                className="rounded-full px-6 py-2.5 border border-white/10 bg-background/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all whitespace-nowrap min-w-fit md:border-0 md:bg-transparent"
                            >
                                General Logic
                            </TabsTrigger>
                            {sports.map(s => (
                                <TabsTrigger
                                    key={s.id}
                                    value={s.id}
                                    className="rounded-full px-6 py-2.5 border border-white/10 bg-background/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all whitespace-nowrap min-w-fit md:border-0 md:bg-transparent"
                                >
                                    {s.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <TabsContent value="general" className="mt-0 space-y-8">
                                    <GeneralRules />
                                </TabsContent>
                                {sports.map(s => (
                                    <TabsContent key={s.id} value={s.id} className="mt-0 space-y-8">
                                        <SportRules sport={s} />
                                    </TabsContent>
                                ))}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}

function GeneralRules() {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            <RuleCard
                icon={<ArrowUpCircle className="w-6 h-6 text-emerald-500" />}
                title="The Ladder Logic"
                description="Climb by defeating opponents ranked higher than you. If you win, you take their spot, and everyone shifts down. If you lose to a lower rank, you drop."
            />
            <RuleCard
                icon={<Target className="w-6 h-6 text-amber-500" />}
                title="ELO Ratings"
                description="Every player has an ELO rating that updates after every match based on the opponent's strength. This is separate from your Ladder Rank."
            />
            <RuleCard
                icon={<Swords className="w-6 h-6 text-primary" />}
                title="Challenges"
                description="You can challenge players within a specific range above you. Once a challenge is accepted, you have a set number of days to play the match."
            />
            <RuleCard
                icon={<ShieldAlert className="w-6 h-6 text-red-500" />}
                title="Fair Play"
                description="Matches must be played in good spirit. Reporting false scores or manipulating ranks will lead to disqualification."
            />
        </div>
    )
}

function SportRules({ sport }: { sport: Sport }) {
    const config = sport.scoring_config || {} as ScoringConfig

    return (
        <div className="space-y-8">
            <div className="bg-card/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 text-center space-y-4 shadow-xl">
                <h2 className="text-2xl font-bold flex items-center justify-center gap-3">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                    How to Win at {sport.name}
                </h2>
                <p className="text-muted-foreground">
                    Matches are decided by
                    <strong className="text-foreground"> {config.type === 'sets' ? 'Sets' : 'overall Score'}</strong>.
                </p>

                <div className="flex flex-wrap justify-center gap-4 pt-4">
                    {config.type === 'sets' && (
                        <>
                            <StatBadge label="Total Sets" value={config.total_sets || 3} icon={<FileText className="w-4 h-4" />} />
                            <StatBadge label="Points / Set" value={config.points_per_set || 21} icon={<Target className="w-4 h-4" />} />
                        </>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-card/30 border-white/10 backdrop-blur">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-3 text-primary justify-center">
                            <Swords className="w-6 h-6" />
                            <h3 className="font-bold uppercase tracking-wider text-sm">Challenge Range</h3>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-black">{config.max_challenge_range || 3}</div>
                            <div className="text-xs text-muted-foreground uppercase font-semibold mt-1">Ranks Above</div>
                        </div>
                        <div className="text-center pt-2 border-t border-dashed border-white/10">
                            <div className="text-xl font-bold">{config.max_challenge_below || 1}</div>
                            <div className="text-xs text-muted-foreground uppercase font-semibold">Rank Below</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/30 border-white/10 backdrop-blur">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-3 text-primary justify-center">
                            <Clock className="w-6 h-6" />
                            <h3 className="font-bold uppercase tracking-wider text-sm">Timings</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">To Accept</span>
                                <span className="font-bold">{config.challenge_window_days || 3} Days</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Auto Verify</span>
                                <span className="font-bold">{config.auto_verify_window_days || 1} Day</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Rematch Wait</span>
                                <span className="font-bold">{config.rematch_cooldown_days || 5} Days</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/30 border-white/10 backdrop-blur md:col-span-2 lg:col-span-1">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-3 text-red-500 justify-center">
                            <Gavel className="w-6 h-6" />
                            <h3 className="font-bold uppercase tracking-wider text-sm">Penalties</h3>
                        </div>
                        <div className="text-center space-y-1">
                            <div className="text-xs text-muted-foreground uppercase">Inactive for</div>
                            <div className="text-2xl font-black">{config.penalty_days || 14} Days</div>
                            <div className="text-xs text-muted-foreground opacity-60">Results in</div>
                            <div className="text-lg font-bold text-red-400">-{config.penalty_rank_drop || 1} Rank Drop</div>
                        </div>
                        <div className="text-center pt-4 mt-2 border-t border-dashed border-white/10">
                            <div className="text-xs text-muted-foreground uppercase">Removal after</div>
                            <div className="text-xl font-black">{config.removal_days || 45} Days</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function RuleCard({ icon, title, description }: { icon: any, title: string, description: string }) {
    return (
        <Card className="border-white/5 bg-card/60 backdrop-blur-sm shadow-sm hover:bg-card/80 transition-colors">
            <CardContent className="p-6 flex gap-4">
                <div className="shrink-0 p-3 bg-background/50 rounded-2xl h-fit">
                    {icon}
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function StatBadge({ label, value, icon }: { label: string, value: string | number, icon: any }) {
    return (
        <div className="flex items-center gap-3 bg-background/30 px-4 py-2 rounded-xl border border-white/5">
            <div className="text-muted-foreground">{icon}</div>
            <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">{label}</div>
                <div className="font-bold">{value}</div>
            </div>
        </div>
    )
}
