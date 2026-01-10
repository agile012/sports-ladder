
'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
      </CardHeader>
      <CardContent className="pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <span className="bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded text-xs dark:text-yellow-400">Leaders</span>
          Top 5 Players
        </h3>
        <div className="p-1">
          <Table>
            <TableBody>
              {(topList || []).map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group border-b last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="p-3">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-muted-foreground font-bold w-4 text-center">{i + 1}</div>
                      <Link href={`/player/${p.id}`}>
                        <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary transition-all">
                          <AvatarImage src={p.avatar_url ?? (p.user_metadata as UserMeta)?.avatar_url} />
                          <AvatarFallback className="font-bold bg-primary/10 text-primary">
                            {(p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? p.user_email ?? '').toString()[0] ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
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
                            <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-orange-400 transition-all">
                              <AvatarImage src={p.avatar_url ?? (p.user_metadata as UserMeta)?.avatar_url} />
                              <AvatarFallback className="font-bold bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200">
                                {(p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? p.user_email ?? '').toString()[0] ?? 'U'}
                              </AvatarFallback>
                            </Avatar>
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
                          onClick={() => {
                            const name = p.full_name ?? (p.user_metadata as UserMeta)?.full_name ?? 'this player'
                            if (!window.confirm(`Challenge ${name}?`)) return
                            handleChallenge(sport.id, p.id)
                          }}
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
    </>
  )
}
