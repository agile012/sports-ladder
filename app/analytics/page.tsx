import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Trophy, ArrowRight } from 'lucide-react'

export default async function AnalyticsLandingPage() {
    const supabase = await createClient()

    const { data: sports } = await supabase.from('sports').select('id, name')

    if (!sports || sports.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h1 className="text-2xl font-bold">No sports found</h1>
                <p className="text-muted-foreground">Please configure at least one sport to view analytics.</p>
            </div>
        )
    }

    if (sports.length === 1) {
        redirect(`/analytics/${sports[0].id}`)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Analytics Hub
                    </span>
                </h1>
                <p className="text-muted-foreground text-lg">Select a sport to view detailed performance metrics and history.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sports.map((sport: any) => (
                    <Link key={sport.id} href={`/analytics/${sport.id}`} className="group">
                        <Card className="h-full bg-card/50 backdrop-blur border-muted transition-all hover:border-primary/50 hover:bg-muted/30">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <Trophy className="w-6 h-6" />
                                        </div>
                                        <span className="text-xl font-bold">{sport.name}</span>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    View matches, win rates, leaderboards, and rivalry stats for {sport.name}.
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
