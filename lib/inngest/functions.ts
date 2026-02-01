import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";
import nodemailer from 'nodemailer';
import { sendPushToUser } from "@/lib/push";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
})
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@example.com';

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

    // Only send emails for accepted challenges (reject action is no longer supported)
    if (challenger?.user_email && isAccepted) {
      const subject = `Your challenge for ${match.sport?.name}: ${challenger.full_name} vs ${opponent?.full_name} was accepted! Enter the result.`;
      const matchPageUrl = `${PUBLIC_SITE_URL}/matches/${match.id}`;

      // Email to challenger
      const challengerHtml = `
        <p>Your challenge for match ${match.sport?.name}: ${challenger.full_name} vs ${opponent?.full_name} was accepted!</p>
        <p>It's time to play your match. Once completed, please enter the result.</p>
        <p>Who won the match?</p>
        <p>
          <a href="${matchPageUrl}?action=report&winner=${challenger.id}&token=${match.action_token}&reported_by=${challenger.id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">${challenger.full_name} won</a>
          <a href="${matchPageUrl}?action=report&winner=${opponent.id}&token=${match.action_token}&reported_by=${challenger.id}" style="background-color: #008CBA; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin-left: 10px;">${opponent?.full_name} won</a>
        </p>
        <p>
          Or view the match details:
          <a href="${matchPageUrl}" style="background-color: #777; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">View Match</a>
        </p>
      `;

      const challengerMsg = {
        to: challenger.user_email,
        from: FROM_EMAIL,
        subject,
        html: challengerHtml,
      };
      await step.run("send-challenger-email", async () => {
        if (emailEnabled) await transporter.sendMail(challengerMsg);
        if (challenger.user_id) {
          console.log("Sending Push Notification to ", challenger.user_id)
          await sendPushToUser(challenger.user_id, {
            title: "Challenge Accepted!",
            body: `${opponent?.full_name} accepted your challenge in ${match.sport?.name}.`,
            url: matchPageUrl
          })
        }
      });

      // Email to opponent (if available)
      if (opponent?.user_email) {
        const opponentHtml = `
          <p>You have accepted the challenge for ${match.sport?.name}: ${challenger.full_name} vs ${opponent?.full_name}!</p>
          <p>It's time to play your match. Once completed, please enter the result.</p>
          <p>Who won the match?</p>
          <p>
            <a href="${matchPageUrl}?action=report&winner=${challenger.id}&token=${match.action_token}&reported_by=${opponent.id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">${challenger.full_name} won</a>
            <a href="${matchPageUrl}?action=report&winner=${opponent.id}&token=${match.action_token}&reported_by=${opponent.id}" style="background-color: #008CBA; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin-left: 10px;">${opponent?.full_name} won</a>
          </p>
          <p>
            Or view the match details:
            <a href="${matchPageUrl}" style="background-color: #777; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">View Match</a>
          </p>
        `;

        const opponentMsg = {
          to: opponent.user_email,
          from: FROM_EMAIL,
          subject,
          html: opponentHtml,
        };
        await step.run("send-opponent-email", async () => {
          if (emailEnabled) await transporter.sendMail(opponentMsg);
          if (opponent.user_id) {
            console.log("Sending Push Notification to ", opponent.user_id)
            await sendPushToUser(opponent.user_id, {
              title: "Challenge Accepted!",
              body: `You accepted the challenge from ${challenger.full_name}.`,
              url: matchPageUrl
            })
          }
        });
      }
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

    if (verifier?.user_email) {
      await step.run("send-verify-email", async () => {
        const verifyUrl = `${PUBLIC_SITE_URL}/api/matches/${match.id}/verify?token=${match.action_token}`;
        const pushVerifyUrl = `${PUBLIC_SITE_URL}/matches/${match.id}?action=verify&token=${match.action_token}`;
        const confirmUrl = `${verifyUrl}&verify=yes`;
        const disputeUrl = `${verifyUrl}&verify=no`;

        const matchIdentifier = `${match.sport?.name}: ${reporter?.full_name} vs ${verifier?.full_name}`;

        const resultText = match.winner_id === verifierId ? "You won" : `${winner?.full_name} won`;

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

        if (verifier.user_id) {
          console.log("Sending Push Notification to ", verifier.user_id)
          await sendPushToUser(verifier.user_id, {
            title: "Verify Match Result",
            body: `${reporter?.full_name} reported: ${resultText}. Please verify.`,
            url: pushVerifyUrl
          })
        }
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

    if (emails.length > 0) {
      await step.run("send-completion-email", async () => {
        const matchIdentifier = `${player1?.full_name} vs ${player2?.full_name}`;

        const subject = isConfirmed ? `Match [${matchIdentifier}] Completed` : `Match [${matchIdentifier}] Disputed`;
        const profileLink = `${PUBLIC_SITE_URL}/profile`; // Changed to specific match link
        let html = isConfirmed
          ? `<p>The match result has been confirmed and the ladder updated.</p>`
          : `<p>The match result has been disputed. Please re-enter the result on the website.</p>
`;

        html += `<p>View the match details and updated ratings/rankings on the website:</p>
 <p><a href="${profileLink}" style="background-color: #008CBA; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">View Match</a></p>
 `;

        const msg = { to: emails, from: FROM_EMAIL, subject, html };
        if (emailEnabled) await transporter.sendMail(msg)

        const pushTitle = isConfirmed ? "Match Completed" : "Match Disputed";
        const pushBody = isConfirmed ? `Result confirmed for ${matchIdentifier}.` : `Result disputed for ${matchIdentifier}.`;

        console.log("Sending Push Notification to ", player1.user_id, player2.user_id)
        if (player1?.user_id) await sendPushToUser(player1.user_id, { title: pushTitle, body: pushBody, url: profileLink });
        if (player2?.user_id) await sendPushToUser(player2.user_id, { title: pushTitle, body: pushBody, url: profileLink });
      });
    }
  }
);