import './globals.css'
import Header from '../components/Header'
import { ThemeProvider } from "@/components/theme-provider"
import PageTransition from '@/components/PageTransition'
import { Instrument_Sans, Inter } from "next/font/google"

import Background from '@/components/Background'
import MobileNav from '@/components/MobileNav'

import { Toaster } from "@/components/ui/sonner"
import PWAPrompt from '@/components/pwa/PWAPrompt'
import type { Metadata, Viewport } from "next"

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "IIMA Sports Ladder",
  description: "Compete, Rise, Conquer. The official sports ladder for IIMA.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sports Ladder",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

import { AuthProvider } from '@/context/AuthContext'
import { SportsProvider } from '@/context/SportsContext'
import { getCachedSports } from '@/lib/cached-data'
import { createClient } from '@/lib/supabase/server'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sports = await getCachedSports()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${inter.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider initialUser={user}>
            <SportsProvider initialSports={sports}>
              <Background />
              <div className="min-h-screen font-sans antialiased relative flex flex-col">
                <Header />
                <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
                  <PageTransition>
                    {children}
                  </PageTransition>
                </main>
                <MobileNav />
                <Toaster position="top-center" />
                <PWAPrompt />
              </div>
            </SportsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
