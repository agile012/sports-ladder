import { NextResponse, type NextRequest } from 'next/server'

/**
 * API route that sets cookies with httpOnly flag.
 * Called by the browser Supabase client to persist auth cookies
 * server-side, ensuring they always have httpOnly.
 */
export async function POST(request: NextRequest) {
  try {
    const { cookies: cookiesToSet } = await request.json()

    if (!Array.isArray(cookiesToSet)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const response = NextResponse.json({ ok: true })

    for (const { name, value, options } of cookiesToSet) {
      // Only allow Supabase auth cookies (sb-* prefix)
      if (typeof name !== 'string' || !name.startsWith('sb-')) {
        continue
      }

      response.cookies.set(name, value, {
        ...options,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
      })
    }

    return response
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
