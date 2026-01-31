'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Swords } from "lucide-react"
import { cn } from '@/lib/utils'

import Link from "next/link"

type RivalryItem = {
    p1: string
    p2: string
    matches: number
    p1_name: string
    p2_name: string
    p1_wins: number
    p1_avatar?: string
    p2_avatar?: string
    p1_deactivated?: boolean
    p2_deactivated?: boolean
}

export function RivalryCard({ data }: { data: RivalryItem[] | null }) {
    if (!data || data.length === 0) return null

    return (
        <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Swords className="h-5 w-5 text-purple-500" />
                    The Eternal Rivals
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.slice(0, 4).map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-background/40 backdrop-blur border rounded-xl hover:border-purple-500/30 transition-colors">
                            {/* P1 */}
                            <Link href={`/player/${r.p1}`} className={cn("flex items-center gap-3 group/p1", r.p1_deactivated && "opacity-70 grayscale")}>
                                <Avatar className="h-10 w-10 border-2 border-background shadow-sm group-hover/p1:border-primary/50 transition-colors">
                                    <AvatarImage src={r.p1_avatar} />
                                    <AvatarFallback>{(r.p1_name && r.p1_name[0]) ? r.p1_name[0] : '?'}</AvatarFallback>
                                </Avatar>
                                <div className="text-right">
                                    <p className="font-bold text-xs group-hover/p1:text-primary transition-colors">
                                        {r.p1_name || 'Unknown'}
                                        {r.p1_deactivated && <span className="block text-[10px] font-normal opacity-70">(Left)</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono">{r.p1_wins} Wins</p>
                                </div>
                            </Link>

                            <div className="flex flex-col items-center px-4">
                                <span className="text-lg font-black font-mono text-purple-500/50">VS</span>
                                <span className="text--[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">
                                    {r.matches} Matches
                                </span>
                            </div>

                            {/* P2 */}
                            <Link href={`/player/${r.p2}`} className={cn("flex items-center gap-3 flex-row-reverse text-right group/p2", r.p2_deactivated && "opacity-70 grayscale")}>
                                <Avatar className="h-10 w-10 border-2 border-background shadow-sm group-hover/p2:border-primary/50 transition-colors">
                                    <AvatarImage src={r.p2_avatar} />
                                    <AvatarFallback>{(r.p2_name && r.p2_name[0]) ? r.p2_name[0] : '?'}</AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <p className="font-bold text-xs group-hover/p2:text-primary transition-colors">
                                        {r.p2_name || 'Unknown'}
                                        {r.p2_deactivated && <span className="block text-[10px] font-normal opacity-70">(Left)</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono">{r.matches - r.p1_wins} Wins</p>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
