"use client"
import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { RankedPlayerProfile, Sport } from '@/lib/types'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Swords } from 'lucide-react'

type Props = {
  player: RankedPlayerProfile
  rank: number
  isChallengable: boolean
  submittingChallenge: string | null
  handleChallenge: (opponentProfileId: string) => void
  selectedSport: Sport | null
  user: User
  recentMatches?: any[]
}

const RankingsTableRow = React.forwardRef<HTMLTableRowElement, Props>(
  ({ player, rank, isChallengable, submittingChallenge, handleChallenge, selectedSport, user, recentMatches }, ref) => {
    const recent = recentMatches ?? []

    return (
      <motion.tr
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ scale: 1.01, backgroundColor: "var(--accent)" }}
        transition={{ duration: 0.1 }}
        className={cn(
          "border-b transition-colors data-[state=selected]:bg-muted",
          isChallengable ? 'bg-orange-50/50 dark:bg-orange-950/20 hover:!bg-orange-100/50 dark:hover:!bg-orange-900/40' : ''
        )}
      >
        <TableCell className="w-16">
          <Badge
            variant={rank <= 3 ? 'default' : 'secondary'}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-full text-base",
              rank === 1 && "bg-yellow-500 hover:bg-yellow-600",
              rank === 2 && "bg-slate-400 hover:bg-slate-500",
              rank === 3 && "bg-amber-600 hover:bg-amber-700",
              isChallengable && rank > 3 && "bg-orange-500 text-white"
            )}
          >
            {rank}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <Link href={`/player/${player.id}`}>
              <motion.div whileHover={{ scale: 1.1 }}>
                <Avatar className="h-10 w-10 border-2 border-background ring-2 ring-transparent hover:ring-primary transition-all">
                  <AvatarImage src={player.avatar_url} />
                  <AvatarFallback className='bg-primary/10 text-primary font-bold'>
                    {(player.full_name ?? player.user_email ?? player.user_id ?? '')
                      .toString()[0]
                      ?.toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            </Link>
            <div className="flex flex-col">
              <Link href={`/player/${player.id}`} className="font-semibold hover:text-primary transition-colors">
                {player.full_name ?? player.user_email ?? `Player ${rank}`}
              </Link>
              <div className="flex items-center gap-1 mt-1">
                {recent.map((m, idx) => {
                  if (m.result === 'win') return <span key={`r-${player.id}-${idx}`} title="Won" className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500" />
                  if (m.result === 'loss') return <span key={`r-${player.id}-${idx}`} title="Lost" className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500" />
                  return <span key={`r-${player.id}-${idx}`} title="Draw/Pending" className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-muted-foreground/30" />
                })}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono font-bold text-lg">{player.rating}</TableCell>
        <TableCell className="text-right text-muted-foreground">{player.matches_played ?? 0}</TableCell>
        <TableCell className="text-right">
          {selectedSport && user && isChallengable && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                className='bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md font-bold'
                onClick={(e) => {
                  e.stopPropagation() // prevent bubbling if row is clickable
                  const name = player.full_name ?? 'this player'
                  if (!window.confirm(`Challenge ${name}?`)) return
                  handleChallenge(player.id)
                }}
                disabled={submittingChallenge != null}
              >
                <Swords className="w-4 h-4 mr-2" />
                {submittingChallenge === player.id ? '...' : 'Challenge'}
              </Button>
            </motion.div>
          )}
        </TableCell>
      </motion.tr>
    )
  }
)

RankingsTableRow.displayName = 'RankingsTableRow'

export default RankingsTableRow
