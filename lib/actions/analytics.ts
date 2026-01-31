'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function getSportAnalytics(sportId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_sport_analytics', {
        p_sport_id: sportId
    })

    if (error) {
        console.error('Analytics error:', error)
        throw new Error(error.message)
    }

    // Enrich missing names for deactivated players
    try {
        await enrichWithMissingNames(data)
    } catch (e) {
        console.error('Failed to enrich inactive players:', e)
        // detailed logging but don't fail the request
    }

    return data
}

async function enrichWithMissingNames(data: any) {
    const missingProfileIds = new Set<string>()

    // Helper to check and collect ID
    const check = (id: string, name: string | null) => {
        if (id && (!name || name === 'Unknown')) {
            missingProfileIds.add(id)
        }
    }

    // 1. Scan Rivalries
    if (data.rivalries) {
        data.rivalries.forEach((r: any) => {
            check(r.p1, r.p1_name)
            check(r.p2, r.p2_name)
        })
    }

    // 2. Scan Leaderboards
    if (data.leaderboards) {
        const lb = data.leaderboards
        const categories = ['workhorse', 'flawless', 'fortress', 'skyrocketing', 'aggressor', 'wanted']
        categories.forEach(cat => {
            if (lb[cat]) {
                lb[cat].forEach((item: any) => check(item.id, item.name))
            }
        })
        // Win streaks
        if (lb.win_streaks) lb.win_streaks.forEach((item: any) => check(item.id, item.name))
        // Upsets
        if (lb.upsets) {
            lb.upsets.forEach((item: any) => {
                check(item.winner_id, item.winner_name)
                // Upsets has loser_name? The SQL returns loser_name but let's check structure
                // SQL: winner_id, winner_name... no loser_id explicitly named 'id' but implied?
                // SQL selects: winner_id, winner_name, loser_name... wait, where is loser_id?
                // The SQL doesn't return loser_id explicitly in the upset CTE final select?
                // Let's look at SQL again... 'loser_name', 'loser_avatar'. It doesn't return loser_id!
                // So we can't fetch loser name if missing because we don't have ID.
                // Actually the SQL CTE has loser_pp join, so if loser is deactivated, name is null.
                // WE NEED ID to fix it. Reviewing SQL for Upsets... 
                // It returns `winner_id` but not `loser_id`. It returns `loser_name`. 
                // If `loser_name` is null, we are stuck without ID.
                // Recommendation: Ignore upsets for now or accept 'Unknown' for losers in upsets.
            })
        }
    }

    if (missingProfileIds.size === 0) return

    // 3. Fetch Details
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return

    const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // A. Get User IDs from Player Profiles
    const { data: profiles } = await admin
        .from('player_profiles')
        .select('id, user_id, deactivated')
        .in('id', Array.from(missingProfileIds))

    if (!profiles || profiles.length === 0) return

    const userIdMap = new Map<string, string>() // ProfileID -> UserID
    const deactivatedMap = new Map<string, boolean>() // ProfileID -> Deactivated
    const userIds = new Set<string>()

    profiles.forEach(p => {
        userIdMap.set(p.id, p.user_id)
        if (p.deactivated) deactivatedMap.set(p.id, true)
        userIds.add(p.user_id)
    })

    // B. Get User Metadata (Names)
    // admin.auth.admin.listUsers is pagination heavy.
    // Better: We can't batch fetch by ID easily with listUsers (it doesn't support 'in').
    // BUT we can use `admin.from('users').select()`?? No, getting users is restricted.
    // We have to iterate or list all. Since N is small (just unknowns), loop is okay?
    // Actually, `admin.auth.admin.getUserById(id)` is available.
    // Parallel fetch.

    // Optimize: If many unknowns, this is slow. But usually < 5 unknowns.
    const userMap = new Map<string, any>() // UserID -> { name, avatar }

    await Promise.all(Array.from(userIds).map(async (uid) => {
        const { data: { user } } = await admin.auth.admin.getUserById(uid)
        if (user && user.user_metadata) {
            userMap.set(uid, {
                name: user.user_metadata.full_name,
                avatar: user.user_metadata.avatar_url
            })
        }
    }))

    // 4. Update Data with found names
    const update = (obj: any, idKey: string = 'id', nameKey: string = 'name', avatarKey: string = 'avatar') => {
        const pid = obj[idKey]
        if (missingProfileIds.has(pid)) {
            const uid = userIdMap.get(pid)
            if (uid) {
                const info = userMap.get(uid)
                if (info) {
                    if (!obj[nameKey]) obj[nameKey] = info.name
                    if (!obj[avatarKey]) obj[avatarKey] = info.avatar
                }
                if (deactivatedMap.get(pid)) {
                    obj.deactivated = true
                }
            }
        }
    }

    // Apply updates
    if (data.rivalries) {
        data.rivalries.forEach((r: any) => {
            update(r, 'p1', 'p1_name', 'p1_avatar') // P1
            update(r, 'p2', 'p2_name', 'p2_avatar') // P2

            // Special handling for rivalries to mark deactivated
            if (deactivatedMap.get(r.p1)) r.p1_deactivated = true
            if (deactivatedMap.get(r.p2)) r.p2_deactivated = true
        })
    }

    if (data.leaderboards) {
        const lb = data.leaderboards
        const categories = ['workhorse', 'flawless', 'fortress', 'skyrocketing', 'aggressor', 'wanted', 'win_streaks']
        categories.forEach(cat => {
            if (lb[cat]) lb[cat].forEach((item: any) => update(item))
        })

        if (lb.upsets) {
            lb.upsets.forEach((item: any) => {
                update(item, 'winner_id', 'winner_name', 'winner_avatar')
                // Loser ID not available, ignored
            })
        }
    }
}
