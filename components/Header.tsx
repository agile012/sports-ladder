'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from "next-themes"
import { Button } from './ui/button'
import { Moon, Sun, Monitor, Menu, X, Trophy } from "lucide-react"
import { User } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { AnalyticsNav } from './AnalyticsNav'
import { LaddersNav } from './LaddersNav'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [sports, setSports] = useState<{ id: string, name: string }[]>([])
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // Fetch sports
    supabase.from('sports').select('id, name').order('name').then(({ data }) => {
      if (data) setSports(data)
    })

    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function ModeToggle() {
    const { theme, setTheme } = useTheme()
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
        className="rounded-full hover:bg-muted"
      >
        <Sun className={`h-[1.2rem] w-[1.2rem] transition-all ${theme === 'system' ? 'scale-0 -rotate-90' : 'scale-100 rotate-0 dark:scale-0 dark:-rotate-90'}`} />
        <Moon className={`absolute h-[1.2rem] w-[1.2rem] transition-all ${theme === 'system' ? 'scale-0 rotate-90' : 'scale-0 rotate-90 dark:scale-100 dark:rotate-0'}`} />
        <Monitor className={`absolute h-[1.2rem] w-[1.2rem] transition-all ${theme === 'system' ? 'scale-100 rotate-0' : 'scale-0 rotate-90'}`} />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  const navLinks = [
    { name: 'Matches', href: '/match-history' },
    { name: 'Rules', href: '/rules' },
    ...(user ? [{ name: 'Profile', href: '/profile' }] : [])
  ]

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300 ease-in-out",
        scrolled
          ? "bg-background/70 backdrop-blur-md border-b shadow-sm"
          : "bg-transparent border-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            IIMA Sports Ladder
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <LaddersNav sports={sports} />

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary relative group py-2",
                pathname === link.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              {link.name}
              {pathname === link.href && (
                <motion.div
                  layoutId="underline"
                  className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full"
                />
              )}
            </Link>
          ))}

          <AnalyticsNav sports={sports} />

          <div className="flex items-center gap-2 pl-4 border-l border-border/50">
            <ModeToggle />
            {user ? (
              <Button onClick={signOut} variant='ghost' className='font-medium text-sm hover:bg-destructive/10 hover:text-destructive'>Sign out</Button>
            ) : (
              pathname !== '/login' && (
                <Button asChild className="rounded-full font-medium shadow-none">
                  <Link href="/login">Sign in</Link>
                </Button>
              )
            )}
          </div>
        </nav>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ModeToggle />
          <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            <nav className="flex flex-col p-6 gap-4">
              {/* Mobile Ladders Link */}
              <Link
                href="/ladder"
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "text-lg font-medium py-2 border-b border-border/50",
                  pathname?.startsWith('/ladder') ? "text-primary" : "text-muted-foreground"
                )}
              >
                Ladders
              </Link>

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "text-lg font-medium py-2 border-b border-border/50",
                    pathname === link.href ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {link.name}
                </Link>
              ))}

              {/* Analytics Mobile */}
              <div className="py-2 border-b border-border/50">
                <span className="text-lg font-medium text-muted-foreground block mb-2">Analytics</span>
                <div className="pl-4 space-y-2">
                  {sports.map(s => (
                    <Link
                      key={s.id}
                      href={`/analytics/${s.id}`}
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        "block text-base",
                        pathname === `/analytics/${s.id}` ? "text-primary font-bold" : "text-muted-foreground"
                      )}
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                {user ? (
                  <Button onClick={() => { signOut(); setIsMenuOpen(false); }} variant='ghost' className='w-full text-destructive hover:bg-destructive/10 hover:text-destructive font-medium'>Sign out</Button>
                ) : (
                  pathname !== '/login' && (
                    <Button asChild className="w-full">
                      <Link href="/login" onClick={() => setIsMenuOpen(false)}>Sign in</Link>
                    </Button>
                  )
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
