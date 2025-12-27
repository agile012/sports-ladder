'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">Sports Ladder</Link>
        <nav className="flex items-center gap-4">
          <Link href="/ladder" className="text-sm text-gray-700 hover:underline">Ladders</Link>
          {user ? (
            <>
              <Link href="/profile" className="text-sm text-gray-700 hover:underline">Profile</Link>
              <button onClick={signOut} className="text-sm bg-black text-white px-3 py-1 rounded">Sign out</button>
            </>
          ) : (
            pathname !== '/login' && (
              <Link href="/login" className="text-sm bg-blue-600 text-white px-3 py-1 rounded">Sign in with Google</Link>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
