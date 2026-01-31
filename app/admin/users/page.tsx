import { createClient } from '@/lib/supabase/server'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import AdminUserActions from '@/components/admin/AdminUserActions'
import UserFilters from '@/components/admin/UserFilters'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const ITEMS_PER_PAGE = 20

export default async function AdminUsersPage({ searchParams }: Props) {
    const supabase = await createClient()
    const resolvedSearchParams = await searchParams
    const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1
    const sportId = typeof resolvedSearchParams.sport === 'string' ? resolvedSearchParams.sport : 'all'
    const query = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : ''

    // Get current user and their admin sports
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <div>Unauthorized</div>

    const { data: adminProfiles } = await supabase
        .from('player_profiles')
        .select('sport_id')
        .eq('user_id', user.id)
        .eq('is_admin', true)

    const adminSportIds = adminProfiles?.map(p => p.sport_id) || []

    // Fetch all sports for the filter
    const { data: sports } = await supabase
        .from('sports')
        .select('id, name')
        .order('name')
    const sportsMap = Object.fromEntries((sports || []).map(s => [s.id, s.name]))

    // Build Query
    let dbQuery = supabase
        .from('player_profiles_view')
        .select('id, full_name, user_email, sport_id, is_admin', { count: 'exact' })
        .order('full_name')
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

    // Filter by Sport if selected
    if (sportId !== 'all') {
        dbQuery = dbQuery.eq('sport_id', sportId)
    }

    // Search filter
    if (query) {
        dbQuery = dbQuery.or(`full_name.ilike.%${query}%,user_email.ilike.%${query}%`)
    }

    const { data: profiles, count } = await dbQuery
    const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Manage Users</h1>
            <p className="text-muted-foreground">Manage admin privileges for users per sport.</p>

            <UserFilters
                sports={sports || []}
                initialSport={sportId}
                initialSearch={query}
            />

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Sport</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(profiles || []).map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/player/${p.id}`} className="hover:underline text-blue-600">
                                        {p.full_name}
                                    </Link>
                                </TableCell>
                                <TableCell>{p.user_email}</TableCell>
                                <TableCell>{sportsMap[p.sport_id] || p.sport_id}</TableCell>
                                <TableCell>
                                    {p.is_admin ? (
                                        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">Admin</span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Player</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <AdminUserActions profileId={p.id} isAdmin={p.is_admin || false} sportId={p.sport_id} />
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!profiles || profiles.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button variant="outline" size="sm" disabled={page <= 1} asChild>
                        <Link href={`/admin/users?page=${page - 1}&sport=${sportId}&q=${query}`}>Previous</Link>
                    </Button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} asChild>
                        <Link href={`/admin/users?page=${page + 1}&sport=${sportId}&q=${query}`}>Next</Link>
                    </Button>
                </div>
            )}
        </div>
    )
}
