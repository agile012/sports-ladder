import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Sport, PlayerProfile, RankedPlayerProfile } from '@/lib/types'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Trophy, Swords } from 'lucide-react'

type UserMeta = {
  avatar_url?: string
  full_name?: string
}

export default function LadderListItem({
  sport,
  topList,
  challengeList,
  loadingLists,
  submitting,
  handleChallenge,
}: {
  sport: Sport
  topList: PlayerProfile[]
  challengeList: RankedPlayerProfile[]
  loadingLists: boolean
  submitting: boolean
  handleChallenge: (sportId: string, opponentProfileId: string) => void
}) {
  const [alertConfig, setAlertConfig] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
  }>({ open: false, title: '', description: '', action: () => { } })

  /* New state for sorting */
  const [sortBy, setSortBy] = useState<'ladder' | 'rating'>('ladder')

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, open: false }))

  const confirmChallenge = (p: RankedPlayerProfile) => {
    const name = p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? 'this player'
    setAlertConfig({
      open: true,
      title: `Challenge ${name}?`,
      description: `Are you sure you want to send a challenge to ${name}?`,
      action: () => handleChallenge(sport.id, p.id)
    })
  }

  // Sort logic for display
  const displayList = [...(topList || [])].sort((a, b) => {
    if (sortBy === 'ladder') {
      // If ladder_rank missing, fallback to rating (which is filtered descending usually)
      // But actually topList from server is sorted by Rank.
      // Just ensure order.
      return (a.ladder_rank ?? 999999) - (b.ladder_rank ?? 999999)
    } else {
      // Rating desc
      return b.rating - a.rating
    }
  })

  return (
    <>
      <CardHeader className="bg-primary/5 pb-4">
        <div className="flex items-center justify-between">
          <div className='flex items-center gap-3'>
            <div className="bg-primary/10 p-2 rounded-full">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">{sport.name}</CardTitle>
              <CardDescription>Top rankings and challenges</CardDescription>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className='font-semibold hover:bg-primary/10'>
            <Link href={`/ladder?sport=${sport.id}`}>View full ladder</Link>
          </Button>
        </div>

        {/* Sort Controls */}
        <div className="flex justify-end gap-2 mt-2">
          <span className="text-xs text-muted-foreground self-center">Sort by:</span>
          <div className="flex bg-muted rounded-md p-1 h-8">
            <button
              onClick={() => setSortBy('ladder')}
              className={`px-3 text-xs font-medium rounded-sm transition-all ${sortBy === 'ladder' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Ladder
            </button>
            <button
              onClick={() => setSortBy('rating')}
              className={`px-3 text-xs font-medium rounded-sm transition-all ${sortBy === 'rating' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Elo
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <span className="bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded text-xs dark:text-yellow-400">Leaders</span>
          Top 5 Players
        </h3>
        <div className="p-1">
          <Table>
            <TableBody>
              {displayList.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  layout // animate reordering
                  className="group border-b last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="p-3">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-muted-foreground font-bold w-6 text-center">
                        {p.ladder_rank ? (
                          <span title="Ladder Rank">#{p.ladder_rank}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                      <Link href={`/player/${p.id}`}>
                        <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all bg-muted">
                          {(p.avatar_url ?? (p.user_metadata as UserMeta)?.avatar_url) ? (
                            <img
                              src={p.avatar_url ?? (p.user_metadata as UserMeta)?.avatar_url}
                              alt={p.full_name ?? 'User'}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center font-bold bg-primary/10 text-primary">
                              {(p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? p.user_email ?? '').toString()[0] ?? 'U'}
                            </div>
                          )}
                        </div>
                      </Link>
                      <div>
                        <Link href={`/player/${p.id}`} className="hover:text-primary transition-colors">
                          <p className="font-semibold text-base">{p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? p.user_email}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground font-medium">Rating: <span className="text-foreground">{p.rating}</span></p>
                      </div>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>

        <Separator className="my-6 bg-border/50" />

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded text-xs dark:text-red-400">Action</span>
            Players you can challenge
          </h3>
          {loadingLists ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : challengeList && challengeList.length > 0 ? (
            <div className="p-1">
              <Table>
                <TableBody>
                  {challengeList.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + (i * 0.1) }}
                      className="group border-b last:border-0 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <TableCell className="p-3">
                        <div className="flex items-center gap-4">
                          <Link href={`/player/${p.id}`}>
                            <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-orange-400 transition-all bg-muted">
                              {/* Use next/image for optimized loading */}
                              {(p.avatar_url ?? (p.user_metadata as UserMeta)?.avatar_url) ? (
                                <img
                                  src={p.avatar_url ?? (p.user_metadata as UserMeta)?.avatar_url}
                                  alt={p.full_name ?? 'User'}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center font-bold bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200">
                                  {(p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? p.user_email ?? '').toString()[0] ?? 'U'}
                                </div>
                              )}
                            </div>
                          </Link>
                          <div>
                            <Link href={`/player/${p.id}`} className="hover:text-red-600 transition-colors">
                              <p className="font-semibold text-base">{p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? p.user_email}</p>
                            </Link>
                            <p className="text-xs text-muted-foreground font-medium">
                              Rank: {p.rank} • Rating: <span className="text-foreground">{p.rating}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className='bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md font-bold transition-all hover:scale-105 active:scale-95'
                          onClick={() => confirmChallenge(p)}
                          disabled={submitting}
                        >
                          <Swords className="w-4 h-4 mr-2" />
                          Challenge
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-6 bg-muted/30 rounded-lg border border-dashed text-muted-foreground text-sm">
              No players available to challenge currently.
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={alertConfig.open} onOpenChange={(open) => !open && closeAlert()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeAlert}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              alertConfig.action()
              closeAlert()
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
