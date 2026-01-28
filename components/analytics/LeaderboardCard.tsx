'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { Medal, Trophy, TrendingUp, Shield, Swords } from "lucide-react"

import Link from "next/link"

type LeaderboardItem = {
    id: string
    name: string
    avatar?: string
    value: number | string
    subValue?: string
}

type Props = {
    title: string
    subtitle: string
    icon: React.ReactNode
    data: LeaderboardItem[] | null
    valueLabel: string
}

export function LeaderboardCard({ title, subtitle, icon, data, valueLabel }: Props) {
    if (!data || data.length === 0) {
        return (
            <Card className="h-full bg-card/50 backdrop-blur border-dashed">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        {icon}
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    No data available
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full bg-gradient-to-br from-card to-card/50 backdrop-blur border-muted/50 overflow-hidden relative group hover:border-primary/20 transition-all">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-4">
                <CardTitle className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                        <p className="text-xs font-normal text-muted-foreground mt-1">{subtitle}</p>
                    </div>
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        {icon}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest px-2 pb-2 border-b border-border/50">
                    <span>Player</span>
                    <span>{valueLabel}</span>
                </div>
                <div className="space-y-3">
                    {data.map((item, i) => (
                        <motion.div
                            key={item.id || i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                <div className="relative font-mono text-sm font-bold text-muted-foreground/50 w-4 flex-shrink-0">
                                    {i === 0 ? <Trophy className="w-4 h-4 text-amber-500 fill-amber-500/20" /> :
                                        i === 1 ? <Medal className="w-4 h-4 text-slate-400" /> :
                                            i === 2 ? <Medal className="w-4 h-4 text-amber-700" /> :
                                                (i + 1)}
                                </div>
                                <Link
                                    href={`/player/${item.id}`}
                                    className="flex items-center gap-3 flex-1 min-w-0 group/link"
                                >
                                    <Avatar className="h-8 w-8 border border-border group-hover/link:ring-2 ring-primary/20 transition-all">
                                        <AvatarImage src={item.avatar} />
                                        <AvatarFallback>{item.name ? item.name[0] : '?'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col truncate">
                                        <span className="text-sm font-semibold leading-none truncate group-hover/link:text-primary transition-colors">{item.name || 'Unknown'}</span>
                                        {item.subValue && <span className="text-[10px] text-muted-foreground truncate">{item.subValue}</span>}
                                    </div>
                                </Link>
                            </div>
                            <div className="font-mono font-bold text-sm bg-background/50 px-2 py-0.5 rounded border border-border/50 text-foreground">
                                {item.value}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
