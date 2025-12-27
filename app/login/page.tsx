'use client'
import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'

export default function Login() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } })
    setLoading(false)
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Sign in</h1>
        <p className="text-sm text-gray-600 mb-6">Sign in with your Google account to view your ladders and profile.</p>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 px-4 py-2 rounded hover:bg-gray-50"
          disabled={loading}
        > 
          <Image src="/google.svg" alt="Google" width={20} height={20} />
          <span>{loading ? 'Redirecting...' : 'Continue with Google'}</span>
        </button>
        <p className="text-xs text-gray-500 mt-4">Only Google sign-in is supported for accessing private ladders.</p>
      </div>
    </div>
  )
}
