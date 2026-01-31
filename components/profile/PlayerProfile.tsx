'use client'

import MatchHistory from './MatchHistory'
import PendingChallenges from './PendingChallenges'
import RatingHistory from './RatingHistory'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayerProfileExtended } from '@/lib/types'
import { Trophy, TrendingUp, Activity, ExternalLink, Dna, LogOut } from 'lucide-react'
import Link from 'next/link'
import RankHistory from './RankHistory'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { leaveLadder } from '@/lib/actions/ladderActions'
import { toast } from "sonner"
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import useUser from '@/lib/hooks/useUser'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function PlayerProfile({ player, isPublic = false }: { player: PlayerProfileExtended; isPublic?: boolean }) {
  const winRate = player.stats?.winRate ?? 0
  const router = useRouter()
  const { user } = useUser()
  const [loading, setLoading] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  async function handleLeave() {
    setLoading(true)
    try {
      await leaveLadder(player.sport_id, player.user_id)
      toast.success('Left the ladder.')
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message || 'Failed to leave')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Sport Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-3xl font-black tracking-tight">{player.sport_name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider">Active</span>
              <span>•</span>
              <span>Joined {new Date(player.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {!isPublic && (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full gap-2 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary">
              <Link href={`/ladder?sport=${player.sport_id}`}>
                View Ladder <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" disabled={loading} onClick={() => setShowLeaveDialog(true)} className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Leave Ladder">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Key Stats Grid - Floating Glass Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Rank Card - Gold/Amber Theme */}
        <div className="group relative overflow-hidden rounded-2xl border border-amber-200/50 dark:border-amber-500/10 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 backdrop-blur-xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
            <Trophy className="h-20 w-20 text-amber-600" />
          </div>

          <div className="relative z-10 flex flex-col h-full justify-between">
            <span className="text-xs font-bold text-amber-600/80 dark:text-amber-500 uppercase tracking-widest">Current Rank</span>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-amber-900 dark:text-amber-100 tracking-tighter">#{player.rankInfo?.rank ?? '-'}</span>
                <span className="text-sm font-bold text-amber-700/60 dark:text-amber-400">/ {player.rankInfo?.total}</span>
              </div>
              <div className="h-1 w-full bg-amber-100 dark:bg-amber-900/30 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.max(5, ((player.rankInfo?.total - (player.rankInfo?.rank || player.rankInfo?.total)) / player.rankInfo?.total) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Rating Card - Blue Theme */}
        <div className="group relative overflow-hidden rounded-2xl border border-blue-200/50 dark:border-blue-500/10 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/10 backdrop-blur-xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
            <Dna className="h-20 w-20 text-blue-600" />
          </div>

          <div className="relative z-10 flex flex-col h-full justify-between">
            <span className="text-xs font-bold text-blue-600/80 dark:text-blue-500 uppercase tracking-widest">Skill Rating</span>
            <div className="flex flex-col">
              <span className="text-5xl font-black text-blue-900 dark:text-blue-100 tracking-tighter">{player.rating}</span>
              <span className="text-xs font-semibold text-blue-600/70 dark:text-blue-400 flex items-center gap-1 mt-1">
                <Activity className="h-3 w-3" /> ELO System
              </span>
            </div>
          </div>
        </div>

        {/* Win Rate Card - Emerald Theme */}
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/50 dark:border-emerald-500/10 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10 backdrop-blur-xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
            <TrendingUp className="h-20 w-20 text-emerald-600" />
          </div>

          <div className="relative z-10 flex flex-col h-full justify-between">
            <span className="text-xs font-bold text-emerald-600/80 dark:text-emerald-500 uppercase tracking-widest">Win Rate</span>
            <div>
              <span className="text-5xl font-black text-emerald-900 dark:text-emerald-100 tracking-tighter">{winRate}%</span>
              <div className="flex items-center gap-2 mt-2 text-xs font-bold">
                <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {player.stats?.wins}W
                </span>
                <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {player.stats?.losses}L
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* History / Performance Graphs */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-1 shadow-sm overflow-hidden">
            <Tabs defaultValue="rank" className="w-full">
              <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h4 className="font-bold text-sm">Trend Analysis</h4>
                </div>
                <TabsList className="h-8 bg-background/50 p-1">
                  <TabsTrigger value="rank" className="text-xs h-6 px-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-primary data-[state=active]:shadow-sm">Rank</TabsTrigger>
                  <TabsTrigger value="rating" className="text-xs h-6 px-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-primary data-[state=active]:shadow-sm">Rating</TabsTrigger>
                </TabsList>
              </div>

              <div className="p-4 bg-gradient-to-b from-transparent to-muted/10">
                <TabsContent value="rating" className="mt-0 h-[300px]">
                  <RatingHistory ratingHistory={player.ratingHistory} />
                </TabsContent>
                <TabsContent value="rank" className="mt-0 h-[300px]">
                  <RankHistory rankHistory={player.rankHistory} />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Pending Challenges - Full Width */}
          <PendingChallenges challenges={player.pendingChallenges} currentUserIds={[player.id]} isReadOnly={isPublic} />
        </div>

        <div className="lg:col-span-1">
          {/* Match History - Sidebar style */}
          <MatchHistory matches={player.recentMatches} />
        </div>
      </div>

      <ConfirmDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        title="Leave Ladder"
        description="Are you sure you want to leave this ladder? You will lose your current rank. You can rejoin later (penalty applies)."
        confirmLabel="Leave Ladder"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleLeave}
        loading={loading}
      />
    </div>
  )
}
