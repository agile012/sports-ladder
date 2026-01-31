'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PendingChallengeItem } from '@/lib/types'
import { Swords, Check, X, Clock, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import PendingChallengeCard from './PendingChallengeCard'
import { motion, AnimatePresence } from 'framer-motion'

export default function PendingChallenges({
  challenges,
  currentUserIds,
  onAction = () => window.location.reload(),
  isReadOnly = false,
}: {
  challenges: PendingChallengeItem[] | undefined
  currentUserIds: string[]
  onAction?: () => void
  isReadOnly?: boolean
}) {
  if (!challenges || challenges.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className="relative">
          <div className="absolute -inset-1 rounded-full bg-amber-500/20 animate-pulse"></div>
          <ShieldAlert className="h-5 w-5 text-amber-500 relative z-10" />
        </div>
        <h3 className="font-bold text-lg bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
          Pending Challenges
        </h3>
        <span className="ml-auto text-xs font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
          {challenges.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode='popLayout'>
          {challenges.map((c) => {
            const myProfileId = currentUserIds.find(id => id === c.player1?.id || id === c.player2?.id)
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <div className="relative group">
                  {/* Glow effect */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-primary/20 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-500 rounded-lg"></div>

                  <PendingChallengeCard
                    challenge={c}
                    currentUserId={myProfileId}
                    onAction={onAction}
                    isReadOnly={isReadOnly}
                  />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
