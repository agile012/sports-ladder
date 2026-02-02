import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendChallengeEmail, handleMatchAction, handleMatchResult, handleMatchVerification, staleChallengeReminder, schedulingNudge, forfeitWarning, ladderInactivityWarning } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendChallengeEmail,
    handleMatchAction,
    handleMatchResult,
    handleMatchVerification,
    staleChallengeReminder,
    schedulingNudge,
    forfeitWarning,
    ladderInactivityWarning,
  ],
});