import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    isSingleton: true,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    },
    cookies: {
      getAll() {
        // Parse cookies the same way @supabase/ssr does internally — no URI decoding
        return document.cookie
          .split('; ')
          .filter(Boolean)
          .map((cookie) => {
            const eqIndex = cookie.indexOf('=')
            const name = cookie.substring(0, eqIndex)
            const value = cookie.substring(eqIndex + 1)
            return { name, value }
          })
      },
      setAll(cookiesToSet) {
        // Write to document.cookie for immediate client-side availability
        for (const { name, value, options } of cookiesToSet) {
          const maxAge = options?.maxAge ?? 31536000
          const path = options?.path ?? '/'
          const sameSite = options?.sameSite ?? 'lax'
          const securePart = process.env.NODE_ENV === 'production' ? '; secure' : ''
          document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; samesite=${sameSite}${securePart}`
        }

        // Persist via server API to overwrite with httpOnly
        fetch('/api/auth/cookies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies: cookiesToSet }),
          credentials: 'same-origin',
        }).catch(() => {
          // Silent fail - middleware will also set httpOnly on next navigation
        })
      },
    },
  }
)
