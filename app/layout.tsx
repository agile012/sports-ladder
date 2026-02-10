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

import NextLoader from '@/components/NextLoader'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sports = await getCachedSports()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Apple Touch Startup Images for all device sizes */}
        {/* iPhone 14 Pro Max, 15 Pro Max */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />

        {/* iPhone 14 Pro, 15 Pro */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />

        {/* iPhone 14 Plus, 15 Plus */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" />

        {/* iPhone 14, 13, 12, 15 */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />

        {/* iPhone 13 mini, 12 mini */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />

        {/* iPhone 11 Pro Max, XS Max */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" />

        {/* iPhone 11, XR */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />

        {/* iPhone SE (3rd gen, 2nd gen), 8, 7, 6s */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />

        {/* iPad Pro 12.9" */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" />

        {/* iPad Pro 11" */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" />

        {/* iPad Pro 10.5", iPad Air */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)" />

        {/* iPad, iPad Mini */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />

        {/* Fallback for any other iOS device */}
        <link rel="apple-touch-startup-image" href="/web-app-manifest-512x512.png" />
      </head>
      <body className={`${instrumentSans.variable} ${inter.variable}`}>
        <NextLoader />
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
