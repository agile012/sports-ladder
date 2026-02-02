import { inngest } from "./client";
import { supabase, PUBLIC_SITE_URL } from "./utils";
import { sendPushToUser } from "@/lib/push";

export const staleChallengeReminder = inngest.createFunction(
    { id: "stale-challenge-reminder" },
    { cron: "0 9 * * *" }, // Daily at 9 AM
    async ({ step }) => {
        // 1. Fetch stale PROPOSED matches (CHALLENGED status) (> 48h)
        const { data: matches } = await supabase
            .from('matches')
            .select(`
            id, 
            created_at, 
            player2:player2_id(user_id, full_name), 
            player1:player1_id(full_name)
        `)
            .eq('status', 'CHALLENGED')
            .lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

        if (!matches?.length) return { body: "No stale challenges" }

        // 2. Send Push to Defender (Player 2)
        let count = 0
        await Promise.all(matches.map(async (match) => {
            const p2 = Array.isArray(match.player2) ? match.player2[0] : match.player2 as any;
            const p1 = Array.isArray(match.player1) ? match.player1[0] : match.player1 as any;

            if (p2?.user_id) {
                await sendPushToUser(p2.user_id, {
                    title: "Challenge Expiring Soon",
                    body: `${p1?.full_name || 'Opponent'}'s challenge is waiting for you.`,
                    url: `${PUBLIC_SITE_URL}/matches/${match.id}`
                })
                count++
            }
        }))
        return { notified: count }
    }
)

export const schedulingNudge = inngest.createFunction(
    { id: "scheduling-nudge" },
    { cron: "0 9 * * *" },
    async ({ step }) => {
        // 1. Fetch stale ACCEPTED matches (PENDING status) (> 72h from update/create)
        const { data: matches } = await supabase
            .from('matches')
            .select(`
            id, 
            created_at, updated_at,
            player1:player1_id(user_id, full_name), 
            player2:player2_id(user_id, full_name)
        `)
            .eq('status', 'PENDING')
            // Use updated_at if available (acceptance time), else created_at
            .lt('created_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())

        if (!matches?.length) return { body: "No stale scheduled matches" }

        // 2. Send Push
        let count = 0
        await Promise.all(matches.map(async (match) => {
            const msg = {
                title: "Have you played yet?",
                body: "Don't forget to play your match and report the result!",
                url: `${PUBLIC_SITE_URL}/matches/${match.id}`
            }

            const p1 = Array.isArray(match.player1) ? match.player1[0] : match.player1 as any;
            const p2 = Array.isArray(match.player2) ? match.player2[0] : match.player2 as any;

            if (p1?.user_id) await sendPushToUser(p1.user_id, msg)
            if (p2?.user_id) await sendPushToUser(p2.user_id, msg)
            if (p1?.user_id || p2?.user_id) count++
        }))
        return { notified: count }
    }
)

export const forfeitWarning = inngest.createFunction(
    { id: "forfeit-warning" },
    { cron: "0 9 * * *" },
    async ({ step }) => {
        // Fetch active matches (PENDING) with sport config
        const { data: matches } = await supabase
            .from('matches')
            .select(`
            id, created_at, updated_at,
            sport:sports(name, scoring_config),
            player1:player1_id(user_id, full_name),
            player2:player2_id(user_id, full_name)
        `)
            .eq('status', 'PENDING')

        if (!matches?.length) return { body: "No active matches" }

        let count = 0
        const now = new Date()

        await Promise.all(matches.map(async (match) => {
            const config = (match.sport as any)?.scoring_config
            const deadlineDays = config?.challenge_window_days
            if (!deadlineDays) return

            // Use updated_at (acceptance) or created_at
            const refDate = match.updated_at ? new Date(match.updated_at) : new Date(match.created_at)
            const deadline = new Date(refDate.getTime() + deadlineDays * 24 * 60 * 60 * 1000)

            // Time until deadline (in hours)
            const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

            // Warn if due within 24h
            if (diffHours > 0 && diffHours <= 24) {
                const warningMsg = {
                    title: "Match Deadline Warning",
                    body: `Match for ${(match.sport as any)?.name} is due today! Record result or forfeit.`,
                    url: `${PUBLIC_SITE_URL}/matches/${match.id}`
                }
                const p1 = Array.isArray(match.player1) ? match.player1[0] : match.player1 as any
                const p2 = Array.isArray(match.player2) ? match.player2[0] : match.player2 as any;

                if (p1?.user_id) await sendPushToUser(p1.user_id, warningMsg)
                if (p2?.user_id) await sendPushToUser(p2.user_id, warningMsg)
                count++
            }
        }))
        return { notified: count }
    }
)

export const ladderInactivityWarning = inngest.createFunction(
    { id: "ladder-inactivity-warning" },
    { cron: "0 9 * * *" },
    async ({ step }) => {
        // Fetch keys for all active players
        const { data: players } = await supabase
            .from('player_profiles')
            .select(`
            id, user_id, full_name, created_at,
            sport:sports(name, scoring_config)
        `)
            .eq('deactivated', false)

        if (!players?.length) return { body: "No players" }

        let count = 0
        const now = new Date()

        await Promise.all(players.map(async (player) => {
            const config = (player.sport as any)?.scoring_config
            if (!config?.penalty_days && !config?.removal_days) return

            // Get Last Link
            const { data: lastMatch } = await supabase
                .from('matches')
                .select('created_at')
                .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
                .eq('status', 'COMPLETED')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            const lastPlayed = lastMatch ? new Date(lastMatch.created_at) : new Date(player.created_at || 0)
            const daysInactive = (now.getTime() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24)

            // Penalty Warning (1 day before)
            if (config.penalty_days) {
                const daysUntil = config.penalty_days - daysInactive
                if (daysUntil > 0 && daysUntil <= 1) {
                    await sendPushToUser(player.user_id, {
                        title: "Inactivity Warning",
                        body: `You are about to lose rank in ${(player.sport as any)?.name} due to inactivity!`,
                        url: `${PUBLIC_SITE_URL}/profile`
                    })
                    count++
                    return
                }
            }

            // Removal Warning (1 day before)
            if (config.removal_days) {
                const daysUntil = config.removal_days - daysInactive
                if (daysUntil > 0 && daysUntil <= 1) {
                    await sendPushToUser(player.user_id, {
                        title: "Ladder Removal Warning",
                        body: `You will be removed from ${(player.sport as any)?.name} ladder tomorrow due to inactivity.`,
                        url: `${PUBLIC_SITE_URL}/profile`
                    })
                    count++
                }
            }
        }))
        return { notified: count }
    }
)
