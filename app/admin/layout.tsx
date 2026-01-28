import AdminGuard from '@/components/admin/AdminGuard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AdminGuard>
            <div className="flex min-h-screen flex-col md:flex-row">
                <aside className="w-full md:w-64 border-r bg-muted/40 p-6 flex flex-col gap-6">
                    <div className="font-bold text-xl px-2">Admin Panel</div>
                    <nav className="flex flex-col gap-2">
                        <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/admin">Dashboard</Link>
                        </Button>
                        <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/admin/sports">Sports</Link>
                        </Button>
                        <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/admin/matches">Matches</Link>
                        </Button>
                        <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/admin/users">Users & Admins</Link>
                        </Button>
                        <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/admin/verifications">Verifications</Link>
                        </Button>
                        <div className="my-2 border-t" />
                        <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/">Back to App</Link>
                        </Button>
                    </nav>
                </aside>
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </AdminGuard>
    )
}
