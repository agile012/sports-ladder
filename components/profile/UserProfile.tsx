'use client'

import PlayerProfile from './PlayerProfile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlayerProfileExtended } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Shield, Mail, User as UserIcon } from 'lucide-react'

export interface UserInfo {
  id: string
  email?: string
  avatar_url?: string
}

export default function UserProfile({
  userInfo,
  myPlayers,
  isAdmin,
  isPublic = false
}: {
  userInfo: UserInfo;
  myPlayers: PlayerProfileExtended[],
  isAdmin?: boolean,
  isPublic?: boolean
}) {
  // Derive full name from the first player profile if available
  const fullName = myPlayers[0]?.full_name || userInfo.email?.split('@')[0] || 'Unknown User'
  const displayEmail = userInfo.email

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border shadow-sm p-8"
      >
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="relative flex flex-col md:flex-row items-center gap-6 z-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Avatar className="h-24 w-24 md:h-32 md:w-32 ring-4 ring-background shadow-xl">
              <AvatarImage src={userInfo.avatar_url} alt="avatar" />
              <AvatarFallback className="text-4xl font-bold bg-primary/20 text-primary">
                {fullName[0]?.toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
          </motion.div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{fullName}</h1>
            <div className="flex flex-col md:flex-row items-center gap-3 text-muted-foreground">
              {displayEmail && (
                <div className="flex items-center gap-1.5 bg-background/50 px-3 py-1 rounded-full text-sm backdrop-blur border">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{displayEmail}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-background/50 px-3 py-1 rounded-full text-sm backdrop-blur border">
                <UserIcon className="h-3.5 w-3.5" />
                <span className="font-mono text-xs">{userInfo.id.substring(0, 8)}...</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {isAdmin && (
              <Button variant="default" asChild className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20">
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Link>
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats / Player Profiles */}
      <div className="space-y-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight px-1">
          <span className="bg-primary/10 text-primary p-1 rounded-md">
            <UserIcon className="h-6 w-6" />
          </span>
          Sports Performance
        </h2>
        {myPlayers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/30">
            <p className="text-lg mb-2">You haven't joined any sports ladders yet.</p>
            <Button asChild className="mt-4">
              <Link href="/">Find a ladder to join</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {myPlayers.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + (i * 0.1) }}
              >
                <PlayerProfile player={p} isPublic={isPublic} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
