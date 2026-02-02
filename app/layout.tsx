import './globals.css'
import Header from '../components/Header'
import { ThemeProvider } from "@/components/theme-provider"
import PageTransition from '@/components/PageTransition'

import Background from '@/components/Background'
import MobileNav from '@/components/MobileNav'

import { Toaster } from "@/components/ui/sonner"
import PWAPrompt from '@/components/pwa/PWAPrompt'
import type { Metadata, Viewport } from "next"

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
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
        </ThemeProvider>
      </body>
    </html>
  )
}
