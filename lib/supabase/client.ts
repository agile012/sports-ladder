import { createBrowserClient  } from '@supabase/ssr'

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
        // Read cookies from the browser normally
        return document.cookie
          .split('; ')
          .filter(Boolean)
          .map((cookie) => {
            const [name, ...rest] = cookie.split('=')
            return { name, value: decodeURIComponent(rest.join('=')) }
          })
      },
      setAll() {
        // No-op: the middleware handles all cookie writes with httpOnly.
        // The browser client keeps refreshed tokens in memory via isSingleton.
      },
    },
  }
)
