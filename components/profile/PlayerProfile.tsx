'use client'

import MatchHistory from './MatchHistory'
import PendingChallenges from './PendingChallenges'
import RatingHistory from './RatingHistory'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlayerProfileExtended } from '@/lib/types'
import { Trophy, TrendingUp, TrendingDown, Activity, ExternalLink, Dna } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import RankHistory from './RankHistory'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function PlayerProfile({ player, isPublic = false }: { player: PlayerProfileExtended; isPublic?: boolean }) {
  const winRate = player.stats?.winRate ?? 0

  return (
    <Card className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
      {/* Cleaner Sport Header */}
      <div className="border-b bg-muted/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-1 bg-primary rounded-full" /> {/* Visual accent */}
          <div>
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
              {player.sport_name}
            </h3>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Performance Summary</p>
          </div>
        </div>
        {!isPublic && (
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
            <Link href={`/ladder?sport=${player.sport_id}`}>
              View Ladder <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>

      <CardContent className="p-6 space-y-8">
        {/* Key Stats Grid - Clean & Minimal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rank Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border border-yellow-100 dark:border-yellow-900/50 rounded-xl p-4 flex flex-col justify-center">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Trophy className="h-16 w-16 text-yellow-600" />
            </div>
            <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-wider mb-1">Current Rank</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-foreground">{player.rankInfo?.rank ?? '-'}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {player.rankInfo?.total ?? '-'}</span>
            </div>
          </div>

          {/* Rating Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 flex flex-col justify-center">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Dna className="h-16 w-16 text-blue-600" />
            </div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wider mb-1">Rating Points</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-foreground">{player.rating}</span>
              <span className="text-sm text-green-600 font-bold flex items-center">
                <Activity className="h-3 w-3 mr-1" /> Active
              </span>
            </div>
          </div>

          {/* Win Rate Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-4 flex flex-col justify-center">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <TrendingUp className="h-16 w-16 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-wider mb-1">Win Rate</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-foreground">{winRate}%</span>
              <span className="text-sm text-muted-foreground font-medium">
                ({player.stats?.wins}W - {player.stats?.losses}L)
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Split: Chart vs History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Rating Chart */}
            {/* History Charts with Tabs */}
            <div className="rounded-xl border bg-card p-1 shadow-sm">
              <Tabs defaultValue="rank" className="w-full">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Performance History</h4>
                  </div>
                  <TabsList className="h-8">
                    <TabsTrigger value="rank" className="text-xs h-6 px-2">Rank</TabsTrigger>
                    <TabsTrigger value="rating" className="text-xs h-6 px-2">Rating</TabsTrigger>
                  </TabsList>
                </div>

                <div className="p-4">
                  <TabsContent value="rating" className="mt-0">
                    <RatingHistory ratingHistory={player.ratingHistory} />
                  </TabsContent>
                  <TabsContent value="rank" className="mt-0">
                    <RankHistory rankHistory={player.rankHistory} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Pending Challenges Area - Full Width in this column */}
            <PendingChallenges challenges={player.pendingChallenges} currentUserIds={[player.id]} isReadOnly={isPublic} />
          </div>

          <div className="lg:col-span-1">
            {/* Match History - Sidebar style */}
            <MatchHistory matches={player.recentMatches} />
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
