import { createClient } from '@/lib/supabase/server'
import UserFilters from '@/components/admin/UserFilters'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import UserManagementTable from '@/components/admin/UserManagementTable'

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
    const cohortId = typeof resolvedSearchParams.cohort === 'string' ? resolvedSearchParams.cohort : 'all'

    // Get current user and their admin sports
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <div>Unauthorized</div>

    // Check Superuser
    const { data: profile } = await supabase.from('profiles').select('superuser').eq('id', user.id).single()
    const isSuperuser = !!profile?.superuser

    let adminSportIds: string[] = []

    if (isSuperuser) {
        const { data: allSports } = await supabase.from('sports').select('id')
        adminSportIds = allSports?.map(s => s.id) || []
    } else {
        const { data: adminProfiles } = await supabase
            .from('player_profiles')
            .select('sport_id')
            .eq('user_id', user.id)
            .eq('is_admin', true)

        adminSportIds = adminProfiles?.map(p => p.sport_id) || []
    }

    // Fetch all sports for the filter
    const { data: sports } = await supabase
        .from('sports')
        .select('id, name')
        .order('name')
    const sportsMap = Object.fromEntries((sports || []).map(s => [s.id, s.name]))

    // Fetch cohorts
    const { data: cohorts } = await supabase
        .from('cohorts')
        .select('id, name')
        .order('name')

    // Build Query
    let dbQuery = supabase
        .from('player_profiles_view')
        .select('id, full_name, user_email, sport_id, is_admin, user_id, contact_number, cohort_id', { count: 'exact' })
        .order('full_name')
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

    // Filter by methods
    if (sportId !== 'all') {
        // Ensure they are admin of the requested sport (or superuser)
        if (adminSportIds.includes(sportId as string)) {
            dbQuery = dbQuery.eq('sport_id', sportId)
        } else {
            // Not allowed, show nothing (or empty)
            dbQuery = dbQuery.in('sport_id', [])
        }
    } else {
        // Show all they are allowed to see
        dbQuery = dbQuery.in('sport_id', adminSportIds)
    }

    // Filter by Cohort if selected
    if (cohortId !== 'all') {
        dbQuery = dbQuery.eq('cohort_id', cohortId)
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
            <p className="text-muted-foreground">Manage admin privileges and user details.</p>

            <UserFilters
                sports={sports || []}
                cohorts={cohorts || []}
                initialSport={sportId}
                initialSearch={query}
                initialCohort={cohortId}
            />

            <UserManagementTable
                profiles={profiles as any[] || []}
                sportsMap={sportsMap}
                cohorts={cohorts || []}
            />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button variant="outline" size="sm" disabled={page <= 1} asChild>
                        <Link href={`/admin/users?page=${page - 1}&sport=${sportId}&q=${query}&cohort=${cohortId}`}>Previous</Link>
                    </Button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} asChild>
                        <Link href={`/admin/users?page=${page + 1}&sport=${sportId}&q=${query}&cohort=${cohortId}`}>Next</Link>
                    </Button>
                </div>
            )}
        </div>
    )
}
