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
        <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Swords className="h-5 w-5 text-purple-500" />
                    The Eternal Rivals
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-4">
                    {data.slice(0, 4).map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-3 md:p-4 bg-background/40 backdrop-blur border rounded-xl hover:border-purple-500/30 transition-colors gap-2">
                            {/* P1 */}
                            <Link href={`/player/${r.p1}`} className={cn("flex items-center gap-2 md:gap-3 group/p1 min-w-0 flex-shrink", r.p1_deactivated && "opacity-70 grayscale")}>
                                <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-background shadow-sm group-hover/p1:border-primary/50 transition-colors flex-shrink-0">
                                    <AvatarImage src={r.p1_avatar} />
                                    <AvatarFallback>{(r.p1_name && r.p1_name[0]) ? r.p1_name[0] : '?'}</AvatarFallback>
                                </Avatar>
                                <div className="text-right min-w-0">
                                    <p className="font-bold text-xs md:text-sm group-hover/p1:text-primary transition-colors truncate max-w-[80px] md:max-w-none">
                                        {r.p1_name || 'Unknown'}
                                        {r.p1_deactivated && <span className="block text-[10px] font-normal opacity-70">(Left)</span>}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground font-mono">{r.p1_wins} W</p>
                                </div>
                            </Link>

                            <div className="flex flex-col items-center px-2 md:px-4 flex-shrink-0">
                                <span className="text-sm md:text-lg font-black font-mono text-purple-500/50">VS</span>
                                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-500 px-1.5 md:px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {r.matches} M
                                </span>
                            </div>

                            {/* P2 */}
                            <Link href={`/player/${r.p2}`} className={cn("flex items-center gap-2 md:gap-3 flex-row-reverse text-right group/p2 min-w-0 flex-shrink", r.p2_deactivated && "opacity-70 grayscale")}>
                                <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-background shadow-sm group-hover/p2:border-primary/50 transition-colors flex-shrink-0">
                                    <AvatarImage src={r.p2_avatar} />
                                    <AvatarFallback>{(r.p2_name && r.p2_name[0]) ? r.p2_name[0] : '?'}</AvatarFallback>
                                </Avatar>
                                <div className="text-left min-w-0">
                                    <p className="font-bold text-xs md:text-sm group-hover/p2:text-primary transition-colors truncate max-w-[80px] md:max-w-none">
                                        {r.p2_name || 'Unknown'}
                                        {r.p2_deactivated && <span className="block text-[10px] font-normal opacity-70">(Left)</span>}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground font-mono">{r.matches - r.p1_wins} W</p>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
