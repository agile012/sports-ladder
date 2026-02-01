'use client'

import PlayerProfile from './PlayerProfile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlayerProfileExtended } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Shield, Mail, User as UserIcon, Phone, Pencil, Loader2, Sparkles, LogOut, Sun, Moon, Monitor, Bell, BellOff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { updateContactInfo } from '@/lib/actions/profileActions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useTheme } from "next-themes"

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
  const fullName = myPlayers[0]?.full_name || userInfo.email?.split('@')[0] || 'Unknown User'
  const displayEmail = userInfo.email
  const isOwnProfile = !isPublic
  const { theme, setTheme } = useTheme()
  const { isSupported, subscription, subscribe, unsubscribe, loading: pushLoading } = usePushNotifications()

  const handlePushToggle = async () => {
    if (subscription) {
      await unsubscribe()
      toast.success('Notifications disabled')
    } else {
      const result = await subscribe()
      if (result) toast.success('Notifications enabled')
      else toast.error('Failed to enable notifications')
    }
  }

  const router = useRouter()
  const [editingContact, setEditingContact] = useState(false)
  const [contactNumber, setContactNumber] = useState(myPlayers[0]?.contact_number || '')
  const [savingContact, setSavingContact] = useState(false)

  const displayContact = (myPlayers[0]?.contact_number) || 'Add Phone Number'

  async function handleUpdateContact() {
    setSavingContact(true)
    try {
      await updateContactInfo(contactNumber)
      toast.success('Contact info updated')
      setEditingContact(false)
      router.refresh()
    } catch (e: any) {
      toast.error('Failed to update: ' + e.message)
    } finally {
      setSavingContact(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    toast.success('Signed out successfully')
    router.refresh()
    router.push('/login')
  }

  return (
    <div className="space-y-12 pb-20 overflow-x-hidden">
      {/* Immersive Hero Header */}
      <div className="relative -mx-4 md:-mx-8 lg:-mx-12 -mt-6 mb-16">
        {/* Background Gradient/Mesh */}
        <div className="absolute inset-0 h-[280px] bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/20 dark:from-indigo-900/40 dark:via-purple-900/20 dark:to-pink-900/20 blur-3xl" />

        <div className="relative pt-12 pb-6 px-6 flex flex-col items-center justify-center text-center z-10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative"
          >
            {/* Glowing ring behind avatar */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-xl opacity-40 animate-pulse"></div>

            <Avatar className="h-32 w-32 md:h-40 md:w-40 ring-4 ring-background/80 backdrop-blur shadow-2xl relative z-10 border-4 border-white/10">
              <AvatarImage src={userInfo.avatar_url} alt="avatar" className="object-cover" />
              <AvatarFallback className="text-5xl font-black bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 dark:from-indigo-900 dark:to-purple-900 dark:text-indigo-300">
                {fullName[0]?.toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>

            {isAdmin && (
              <div className="absolute bottom-0 right-0 z-20 bg-gradient-to-r from-amber-400 to-orange-500 text-white p-2 rounded-full shadow-lg border-2 border-background" title="Admin">
                <Shield className="h-5 w-5" />
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-6 space-y-2"
          >
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              {fullName}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {/* Email Pill */}
              {displayEmail && (
                <div className="flex items-center gap-2 bg-background/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-sm text-sm font-medium text-muted-foreground hover:bg-background/60 transition-colors">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{displayEmail}</span>
                </div>
              )}

              {/* Contact Pill */}
              <div className="flex items-center gap-2 bg-background/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-sm text-sm font-medium text-muted-foreground hover:bg-background/60 transition-colors group cursor-pointer">
                <Phone className="h-3.5 w-3.5" />
                <span>{displayContact}</span>
                {!isPublic && (
                  <Dialog open={editingContact} onOpenChange={setEditingContact}>
                    <DialogTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Mobile Number</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input
                            value={contactNumber}
                            onChange={e => setContactNumber(e.target.value)}
                            placeholder="+91 99999 99999"
                          />
                          <p className="text-xs text-muted-foreground">Visible to opponents for coordination.</p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleUpdateContact} disabled={savingContact}>
                          {savingContact && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Admin Actions & Sign Out */}
      <div className="flex flex-col items-center gap-4 -mt-8 mb-8 relative z-20">
        {isAdmin && (
          <Button variant="default" asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xl shadow-indigo-500/20 rounded-full px-6">
            <Link href="/admin">
              <Shield className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Link>
          </Button>
        )}

        {isOwnProfile && (
          <div className="flex flex-wrap justify-center gap-2 max-w-full px-2">

            {isSupported && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePushToggle}
                disabled={pushLoading}
                className="rounded-full bg-background/50 backdrop-blur border-white/10 shrink-0"
              >
                {subscription ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                {subscription ? 'Disable Notifications' : 'Enable Notifications'}
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')} className="rounded-full bg-background/50 backdrop-blur border-white/10 shrink-0">
              <Sun className={`h-4 w-4 mr-2 transition-all ${theme === 'system' ? 'scale-0 -rotate-90 hidden' : 'scale-100 rotate-0 dark:scale-0 dark:-rotate-90 dark:hidden'}`} />
              <Moon className={`h-4 w-4 mr-2 transition-all ${theme === 'system' ? 'scale-0 rotate-90 hidden' : 'scale-0 rotate-90 hidden dark:scale-100 dark:rotate-0 dark:block'}`} />
              <Monitor className={`h-4 w-4 mr-2 transition-all ${theme === 'system' ? 'scale-100 rotate-0' : 'scale-0 rotate-90 hidden'}`} />

              <span>{theme === 'system' ? 'System' : theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full shrink-0">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}
      </div>

      {/* Stats / Player Profiles */}
      <div className="space-y-6 max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Active Sports</h2>
        </div>

        {myPlayers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-12 text-center text-muted-foreground border-2 border-dashed border-muted rounded-2xl bg-muted/10"
          >
            <p className="text-lg mb-4 font-medium">You haven't joined any sports ladders yet.</p>
            <Button asChild size="lg" className="rounded-full font-bold shadow-lg shadow-primary/20">
              <Link href="/">Find a ladder to join</Link>
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-12">
            {myPlayers.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (i * 0.1), duration: 0.5 }}
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
