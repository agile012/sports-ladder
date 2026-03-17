'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'

export default function Login() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback', queryParams: { prompt: 'consent' } } })
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="w-full max-w-sm relative z-10 space-y-8">
        {/* Logo / Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">IIMA Sports Ladder</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to view your ladders, track rankings, and challenge opponents.
          </p>
        </div>

        {/* Sign In Card */}
        <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-lg space-y-4">
          <Button
            onClick={signInWithGoogle}
            className="w-full h-12 flex items-center justify-center gap-3 text-base font-semibold"
            disabled={loading}
          >
            <Image src="/google.svg" alt="Google" width={20} height={20} />
            <span>{loading ? 'Redirecting...' : 'Continue with Google'}</span>
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Only Google sign-in is supported for accessing private ladders.
          </p>
        </div>
      </div>
    </div>
  )
}
