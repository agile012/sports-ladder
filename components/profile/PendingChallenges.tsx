
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PendingChallengeItem } from '@/lib/types'
import { Swords, Check, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

import PendingChallengeCard from './PendingChallengeCard'

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
    <Card className="border-l-4 border-l-primary shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Pending Challenges</CardTitle>
        </div>
        <CardDescription>Action required for these matches</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {challenges.map((c) => {
          const myProfileId = currentUserIds.find(id => id === c.player1?.id || id === c.player2?.id)
          return (
            <PendingChallengeCard
              key={c.id}
              challenge={c}
              currentUserId={myProfileId}
              onAction={onAction}
              isReadOnly={isReadOnly}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

function LoaderIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
