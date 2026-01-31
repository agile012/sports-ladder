import './globals.css'
import Header from '../components/Header'
import { ThemeProvider } from "@/components/theme-provider"
import PageTransition from '@/components/PageTransition'

import Background from '@/components/Background'
import MobileNav from '@/components/MobileNav'

import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="Sports Ladder" />
      </head>
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
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
