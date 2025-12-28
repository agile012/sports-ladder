import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendChallengeEmail, handleMatchAction, handleMatchResult, handleMatchVerification } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendChallengeEmail,
    handleMatchAction,
    handleMatchResult,
    handleMatchVerification,
  ],
});