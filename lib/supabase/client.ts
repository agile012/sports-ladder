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
        return document.cookie
          .split('; ')
          .filter(Boolean)
          .map((cookie) => {
            const [name, ...rest] = cookie.split('=')
            return { name, value: decodeURIComponent(rest.join('=')) }
          })
      },
      setAll(cookiesToSet) {
        // Write to document.cookie for immediate client-side availability
        for (const { name, value, options } of cookiesToSet) {
          const maxAge = options?.maxAge ?? 31536000
          const path = options?.path ?? '/'
          const sameSite = options?.sameSite ?? 'lax'
          const securePart = process.env.NODE_ENV === 'production' ? '; secure' : ''
          document.cookie = `${name}=${encodeURIComponent(value)}; path=${path}; max-age=${maxAge}; samesite=${sameSite}${securePart}`
        }

        // Persist via server API to get httpOnly (overwrites the above)
        fetch('/api/auth/cookies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies: cookiesToSet }),
          credentials: 'same-origin',
        }).catch(() => {
          // Silent fail - middleware will also set httpOnly on next request
        })
      },
    },
  }
)
