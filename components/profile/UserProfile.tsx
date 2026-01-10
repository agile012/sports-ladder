
'use client'

import PlayerProfile from './PlayerProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User } from '@supabase/supabase-js'
import { PlayerProfileExtended } from '@/lib/types'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function UserProfile({ user, myPlayers, isAdmin }: { user: User; myPlayers: PlayerProfileExtended[], isAdmin: boolean }) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.user_metadata.avatar_url} alt="avatar" />
          <AvatarFallback>{user.email?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="overflow-hidden space-y-2">
          <CardTitle className="text-3xl truncate">{user.email}</CardTitle>
          <CardDescription>Member ID: {user.id}</CardDescription>
          {isAdmin && (
            <Button variant="default" asChild className="bg-purple-600 hover:bg-purple-700 text-white">
              <Link href="/admin">Admin Dashboard</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="text-xl font-semibold mb-4">Your Player Profiles</h3>
        {myPlayers.length === 0 ? (
          <p className="text-muted-foreground">You don&apos;t have any player profiles yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myPlayers.map((p) => (
              <div key={p.id} className="flex-1 min-w-full md:min-w-[500px]">
                <PlayerProfile player={p} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
