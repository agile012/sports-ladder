import { inngest } from "./client";
import { supabase, transporter, PUBLIC_SITE_URL, FROM_EMAIL } from "./utils";
import { sendPushToUser } from "@/lib/push";

export const handleMatchAction = inngest.createFunction(
    { id: "handle-match-action" },
    { event: "match.action" },
    async ({ event, step }) => {
        const { matchId, action } = event.data;
        const isAccepted = action === "accept";

        const match = await step.run("fetch-match", async () => {
            const { data } = await supabase.from("matches").select("*, sport:sports(name, scoring_config)").eq("id", matchId).single();
            return data;
        });

        if (!match) return { status: 'error', message: 'Match not found' };

        // Check notification settings for challenge action
        const config = (match.sport as any)?.scoring_config;
        const emailEnabled = config?.notifications?.on_challenge_action !== false;

        // Notify Challenger (player1) about the action
        const { challenger, opponent } = await step.run("fetch-challenger-and-opponent", async () => {
            const { data } = await supabase
                .from("player_profiles_view")
                .select("id, user_id, user_email, full_name") // Select all necessary fields
                .in("id", [match.player1_id, match.player2_id]); // Fetch both players

            const challenger = data?.find((p) => p.id === match.player1_id);
            const opponent = data?.find((p) => p.id === match.player2_id);

            return { challenger, opponent };
        });

        if (!isAccepted) return; // Only process accepted for now

        const matchPageUrl = `${PUBLIC_SITE_URL}/matches/${match.id}`;
        const subject = `Your challenge for ${match.sport?.name}: ${challenger?.full_name} vs ${opponent?.full_name} was accepted! Enter the result.`;

        // Challenger Notifications
        if (challenger?.user_id) {
            await step.run("push-challenger", async () => {
                await sendPushToUser(challenger.user_id, {
                    title: "Challenge Accepted!",
                    body: `${opponent?.full_name} accepted your challenge in ${match.sport?.name}.`,
                    url: matchPageUrl
                })
            });
        }

        if (challenger?.user_email) {
            await step.run("email-challenger", async () => {
                const challengerHtml = `
                    <p>Your challenge for match ${match.sport?.name}: ${challenger.full_name} vs ${opponent?.full_name} was accepted!</p>
                    <p>It's time to play your match. Once completed, please enter the result.</p>
                    <p>Who won the match?</p>
                    <p>
                      <a href="${matchPageUrl}?action=report&winner=${challenger.id}&token=${match.action_token}&reported_by=${challenger.id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">${challenger.full_name} won</a>
                      <a href="${matchPageUrl}?action=report&winner=${opponent?.id}&token=${match.action_token}&reported_by=${challenger.id}" style="background-color: #008CBA; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin-left: 10px;">${opponent?.full_name} won</a>
                    </p>
                    <p>
                      Or view the match details:
                      <a href="${matchPageUrl}" style="background-color: #777; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">View Match</a>
                    </p>
                  `;
                const challengerMsg = { to: challenger.user_email, from: FROM_EMAIL, subject, html: challengerHtml };
                if (emailEnabled) await transporter.sendMail(challengerMsg);
            });
        }

        // Opponent Notifications
        if (opponent?.user_id) {
            await step.run("push-opponent", async () => {
                await sendPushToUser(opponent.user_id, {
                    title: "Challenge Accepted!",
                    body: `You accepted the challenge from ${challenger?.full_name}.`,
                    url: matchPageUrl
                })
            });
        }

        if (opponent?.user_email) {
            await step.run("email-opponent", async () => {
                const opponentHtml = `
                  <p>You have accepted the challenge for ${match.sport?.name}: ${challenger?.full_name} vs ${opponent?.full_name}!</p>
                  <p>It's time to play your match. Once completed, please enter the result.</p>
                  <p>Who won the match?</p>
                  <p>
                    <a href="${matchPageUrl}?action=report&winner=${challenger?.id}&token=${match.action_token}&reported_by=${opponent.id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">${challenger?.full_name} won</a>
                    <a href="${matchPageUrl}?action=report&winner=${opponent.id}&token=${match.action_token}&reported_by=${opponent.id}" style="background-color: #008CBA; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin-left: 10px;">${opponent?.full_name} won</a>
                  </p>
                  <p>
                    Or view the match details:
                    <a href="${matchPageUrl}" style="background-color: #777; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">View Match</a>
                  </p>
                `;
                const opponentMsg = { to: opponent.user_email, from: FROM_EMAIL, subject, html: opponentHtml };
                if (emailEnabled) await transporter.sendMail(opponentMsg);
            });
        }
    }
);

export const handleMatchResult = inngest.createFunction(
    { id: "handle-match-result" },
    { event: "match.result" },
    async ({ event, step }) => {
        const { matchId } = event.data;

        const match = await step.run("fetch-match", async () => {
            const { data } = await supabase
                .from("matches")
                .select(
                    `
          *,
          sport:sports(name, scoring_config)
        `
                )
                .eq("id", matchId).single();
            return data;
        });

        if (!match) return { status: 'error', message: 'Match not found' };

        // Check notification settings for match result
        const config = (match.sport as any)?.scoring_config;
        const emailEnabled = config?.notifications?.on_match_result !== false;

        // Determine who needs to verify (the player who did NOT report the result)
        const verifierId = match.reported_by === match.player1_id ? match.player2_id : match.player1_id;
        const reporterId = match.reported_by;

        const { verifier, reporter } = await step.run("fetch-verifier-and-reporter", async () => {
            const { data } = await supabase
                .from("player_profiles_view")
                .select("id, user_id, user_email, full_name")
                .in("id", [verifierId, reporterId]);

            const verifier = data?.find((p) => p.id === verifierId);
            const reporter = data?.find((p) => p.id === reporterId);
            return { verifier, reporter };
        });

        const winner = await step.run("fetch-winner", async () => {
            if (!match.winner_id) return null;
            const { data } = await supabase
                .from("player_profiles_view")
                .select("full_name")
                .eq("id", match.winner_id)
                .single();
            return data;
        });

        const verifyUrl = `${PUBLIC_SITE_URL}/api/matches/${match.id}/verify?token=${match.action_token}`;
        const pushVerifyUrl = `${PUBLIC_SITE_URL}/matches/${match.id}?action=verify&token=${match.action_token}`;
        const confirmUrl = `${verifyUrl}&verify=yes`;
        const disputeUrl = `${verifyUrl}&verify=no`;
        const matchIdentifier = `${match.sport?.name}: ${reporter?.full_name} vs ${verifier?.full_name}`;
        const resultText = match.winner_id === verifierId ? "You won" : `${winner?.full_name} won`;

        if (verifier?.user_id) {
            await step.run("push-verifier", async () => {
                await sendPushToUser(verifier.user_id, {
                    title: "Verify Match Result",
                    body: `${reporter?.full_name} reported: ${resultText}. Please verify.`,
                    url: pushVerifyUrl
                })
            });
        }

        if (verifier?.user_email) {
            await step.run("email-verifier", async () => {
                let scoresHtml = '';
                if (match.scores && Array.isArray(match.scores) && match.scores.length > 0) {
                    const scoresText = match.scores.map((s: any) => `${s.p1}-${s.p2}`).join(', ');
                    scoresHtml = `<p>Scores: <strong>${scoresText}</strong></p>`;
                }

                const msg = {
                    to: verifier.user_email,
                    from: FROM_EMAIL,
                    subject: `Verify result for ${matchIdentifier}`,
                    html: `
                        <p>The result was entered by the opponent.</p>
                        <p>Result: <strong>${resultText}</strong></p>
                        ${scoresHtml}
                        <p>
                         <a href="${confirmUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">Confirm Result</a>
                         <a href="${disputeUrl}" style="background-color: #f44336; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin-left: 10px;">Dispute Result</a>
                         </p>
                      `,
                };
                if (emailEnabled) await transporter.sendMail(msg)
            });
        }
    }
);

export const handleMatchVerification = inngest.createFunction(
    { id: "handle-match-verification" },
    { event: "match.verify" },
    async ({ event, step }) => {
        const { matchId, action } = event.data;
        const isConfirmed = action === "confirm";

        // Fetch match details along with player emails in one go
        const matchWithPlayers = await step.run("fetch-match-with-players", async () => {
            const { data } = await supabase
                .from("matches")
                .select(
                    `
          *,
          sport:sports(name, scoring_config),
          player1:player_profiles_view!player1_id (user_id, user_email, full_name),
          player2:player_profiles_view!player2_id (user_id, user_email, full_name)
        `
                )
                .eq("id", matchId)
                .single();
            return data;
        });

        if (!matchWithPlayers) return { status: 'error', message: 'Match not found' };

        // Check notification settings for match confirmation/dispute
        const config = (matchWithPlayers.sport as any)?.scoring_config;
        const emailEnabled = config?.notifications?.on_match_confirmed !== false;

        const player1 = matchWithPlayers.player1 as { user_id: string, user_email: string, full_name: string } | null;
        const player2 = matchWithPlayers.player2 as { user_id: string, user_email: string, full_name: string } | null;
        const emails = [player1?.user_email, player2?.user_email].filter(Boolean);

        const matchIdentifier = `${player1?.full_name} vs ${player2?.full_name}`;
        const profileLink = `${PUBLIC_SITE_URL}/profile`; // Changed to specific match link

        if (player1?.user_id) {
            await step.run("push-player1-completion", async () => {
                const pushTitle = isConfirmed ? "Match Completed" : "Match Disputed";
                const pushBody = isConfirmed ? `Result confirmed for ${matchIdentifier}.` : `Result disputed for ${matchIdentifier}.`;
                await sendPushToUser(player1.user_id, { title: pushTitle, body: pushBody, url: profileLink });
            });
        }

        if (player2?.user_id) {
            await step.run("push-player2-completion", async () => {
                const pushTitle = isConfirmed ? "Match Completed" : "Match Disputed";
                const pushBody = isConfirmed ? `Result confirmed for ${matchIdentifier}.` : `Result disputed for ${matchIdentifier}.`;
                await sendPushToUser(player2.user_id, { title: pushTitle, body: pushBody, url: profileLink });
            });
        }

        if (emails.length > 0) {
            await step.run("email-participants", async () => {
                const subject = isConfirmed ? `Match [${matchIdentifier}] Completed` : `Match [${matchIdentifier}] Disputed`;
                let html = isConfirmed
                    ? `<p>The match result has been confirmed and the ladder updated.</p>`
                    : `<p>The match result has been disputed. Please re-enter the result on the website.</p>
`;

                html += `<p>View the match details and updated ratings/rankings on the website:</p>
 <p><a href="${profileLink}" style="background-color: #008CBA; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">View Match</a></p>
 `;
                const msg = { to: emails, from: FROM_EMAIL, subject, html };
                if (emailEnabled) await transporter.sendMail(msg)
            });
        }

        // Notify displaced players (Rank Drops)
        if (isConfirmed) {
            const displaced = await step.run("fetch-displaced-players", async () => {
                // Fetch recent ladder history entries for this sport where rank dropped
                // We assume the DB trigger ran immediately after the update above.
                // We look for entries created in the last 1 minute.
                const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

                const { data: recentChanges } = await supabase
                    .from("ladder_history")
                    .select(`
                        old_rank, new_rank, 
                        player:player_profile_id(user_id)
                    `)
                    .eq("sport_id", matchWithPlayers.sport_id)
                    .gt("created_at", oneMinuteAgo)

                if (!recentChanges?.length) return [];

                return recentChanges.filter((h: any) => h.new_rank > h.old_rank);
            });

            if (displaced.length > 0) {
                const participantUserIds = [player1?.user_id, player2?.user_id];

                // We need to iterate carefully. Inngest steps should ideally be flat or parallelized properly.
                // Ideally we'd use step.sendEvent for individual notifications if there are many, 
                // but for now a loop yielding steps might be too much if not careful.
                // Given the scale, doing it in one step or a loop of promises inside one step is acceptable for now.
                // Let's do distinct steps per user to be "best practice" granular if list is small, or one batch step.
                // Simplest robust way: One step to send all pushes (Promise.all)

                await step.run("push-displaced-players", async () => {
                    await Promise.all(displaced.map(async (entry: any) => {
                        const p = Array.isArray(entry.player) ? entry.player[0] : entry.player as any;
                        if (!p?.user_id) return;

                        // Skip participants
                        if (participantUserIds.includes(p.user_id)) return;

                        await sendPushToUser(p.user_id, {
                            title: "Ladder Rank Dropped",
                            body: `Your rank in ${matchWithPlayers.sport?.name} dropped from #${entry.old_rank} to #${entry.new_rank}.`,
                            url: `${PUBLIC_SITE_URL}/ladder?sport=${matchWithPlayers.sport_id}`
                        });
                    }));
                });
            }
        }
    }
);
