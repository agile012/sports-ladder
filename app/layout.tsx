import './globals.css'
import Header from './components/Header'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-50">
          <Header />
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  )
}
