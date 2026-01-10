import './globals.css'
import Header from '../components/Header'
import { ThemeProvider } from "@/components/theme-provider"
import PageTransition from '@/components/PageTransition'

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
          <div className="min-h-screen bg-background font-sans antialiased relative flex flex-col">
            <Header />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
              <PageTransition>
                {children}
              </PageTransition>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
