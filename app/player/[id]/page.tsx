import { createClient } from '@/lib/supabase/server'
import UserProfile, { UserInfo } from '@/components/profile/UserProfile'
import * as helpers from '@/lib/supabase/supabaseHelpers'
import { PlayerProfile, PlayerProfileExtended, Sport } from '@/lib/types'
import { notFound } from 'next/navigation'

export default async function PublicPlayerProfile({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const id = (await params).id

    // Strategy 1: Treat as Profile ID
    let { data: initialProfile } = await supabase
        .from('player_profiles_view')
        .select('user_id, full_name, user_email, avatar_url')
        .eq('id', id)
        .single()

    let userId = initialProfile?.user_id

    // Strategy 2: If not found, treat as User ID (UUID)
    if (!userId) {
        // Validation: is it a valid UUID?
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            const { data: userProfile } = await supabase
                .from('player_profiles_view')
                .select('user_id')
                .eq('user_id', id)
                .limit(1)
                .single()
            if (userProfile) userId = userProfile.user_id
        }
    }

    if (!userId) {
        return notFound()
    }

    // Now fetch all profiles for this user
    const [{ data: profiles }, { data: sports }, { data: contacts }] = await Promise.all([
        supabase.from('player_profiles_view').select('id, sport_id, rating, matches_played, full_name, avatar_url').eq('user_id', userId).order('rating', { ascending: false }),
        supabase.from('sports').select('id, name'),
        supabase.from('player_profiles').select('id, contact_number').eq('user_id', userId)
    ])

    const sportMap = ((sports as Sport[]) || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>)
    const contactMap = ((contacts as any[]) || []).reduce((acc, c) => ({ ...acc, [c.id]: c.contact_number }), {} as Record<string, string>)

    const profileRows = ((profiles as PlayerProfile[]) || []).map((p) => ({
        ...p,
        sport_name: sportMap[p.sport_id] ?? p.sport_id,
        contact_number: contactMap[p.id]
    }))

    const myPlayers = await Promise.all(
        profileRows.map(async (p): Promise<PlayerProfileExtended> => {
            const [stats, matches, rankInfo, pendingChallenges, ratingHistory, rankHistory] = await Promise.all([
                helpers.getProfileStats(p.id),
                helpers.getMatchesForProfile(p.id, 5),
                helpers.getRankForProfile(p.id, p.sport_id),
                helpers.getPendingChallengesForProfile(p.id),
                helpers.getRatingHistory(p.id),
                helpers.getRankHistory(p.id)
            ])
            return { ...p, stats, recentMatches: matches, rankInfo, pendingChallenges, ratingHistory, rankHistory }
        })
    )

    // Construct public user info from the first profile (assuming shared user metadata)
    const primary = profileRows[0]
    const userInfo: UserInfo = {
        id: userId, // Shows the underlying User ID
        email: initialProfile?.user_email || 'Hidden Email', // Or masked?
        avatar_url: initialProfile?.avatar_url || primary?.avatar_url
    }

    return (
        <div className="container py-8">
            <UserProfile userInfo={userInfo} myPlayers={myPlayers} isAdmin={false} isPublic={true} />
        </div>
    )
}
