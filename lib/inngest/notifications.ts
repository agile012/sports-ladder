import { inngest } from "./client";
import { supabase, transporter, PUBLIC_SITE_URL, FROM_EMAIL } from "./utils";
import { sendPushToUser } from "@/lib/push";

export const sendChallengeEmail = inngest.createFunction(
    { id: "send-challenge-email" },
    { event: "match.new" },
    async ({ event, step }) => {
        const { matchId } = event.data;
        const match = await step.run("fetch-match", async () => {
            const { data } = await supabase
                .from("matches")
                .select("*, sport:sports(name, scoring_config)")
                .eq("id", matchId)
                .single();
            return data;
        });
        if (!match) {
            console.log(`Match ${matchId} not found`);
            return { status: 'error', message: 'Match not found' };
        }

        // Check notification settings
        const config = (match.sport as any)?.scoring_config;
        const emailEnabled = config?.notifications?.on_challenge !== false;

        // Fetch challenger and opponent profiles in one go
        const { challengerProfile, opponent } = await step.run("fetch-profiles", async () => {
            const { data } = await supabase
                .from("player_profiles_view")
                .select("id, user_id, user_email, full_name") // Select all necessary fields
                .in("id", [match.player1_id, match.player2_id]); // Fetch both players

            const challengerProfile = data?.find((p) => p.id === match.player1_id);
            const opponent = data?.find((p) => p.id === match.player2_id);

            return { challengerProfile, opponent };
        });

        if (!opponent?.user_email) return

        await step.run("send-email", async () => {
            const acceptUrl = `${PUBLIC_SITE_URL}/api/matches/${match.id}/action?action=accept&token=${match.action_token}`;
            const pushAcceptUrl = `${PUBLIC_SITE_URL}/matches/${match.id}?action=accept&token=${match.action_token}`;
            const sportName = match.sport?.name || match.sport_id;
            const msg = {
                to: opponent.user_email,
                from: FROM_EMAIL, // Update this to your verified sender
                subject: `You were challenged in ${sportName}`,
                html: `
          <p><strong>${challengerProfile?.full_name || match.player1_id}</strong> has challenged you in the ladder.</p>
          <p>${match.message ?? ""}</p>
          <p>You were challenged in ${sportName}.</p>
          <p>
            <a href="${acceptUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">Accept Challenge</a>
          </p>
        `,
            };

            if (emailEnabled) {
                await transporter.sendMail(msg);
                console.log(`Challenge email sent to ${msg.to}`);
            } else {
                console.log(`Skipping challenge email: Config disabled`);
            }

            // Send Push
            if (opponent.user_id) {
                await sendPushToUser(opponent.user_id, {
                    title: `New Challenge!`,
                    body: `${challengerProfile?.full_name || 'Someone'} challenged you in ${sportName}.`,
                    url: pushAcceptUrl
                })
            }

            return { sent: true, to: msg.to };
        });
    }
);
