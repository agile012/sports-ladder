This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Supabase setup (local dev)

1. Create a Supabase project and go to **Settings → API** to copy the _Project URL_ and _anon_ public key.
2. Add the following variables to a `.env.local` file at the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Enable Google as an OAuth provider in Supabase (Auth → Providers) and set the redirect URL to `http://localhost:3000`.
4. Optionally, run the SQL in `db/seed.sql` via the Supabase SQL editor to populate sample sports and players.


---

## Match challenge emails (Edge Function)

This project includes support for challenge emails via a Supabase Edge Function that listens to DB changes on the `matches` table and sends emails (e.g., SendGrid) when:

- A new challenge is created (status `CHALLENGED`) — opponent receives Accept/Reject links
- A challenger reports a result (status `PROCESSING`) — opponent receives verification link

To set up:

1. Run the SQL in `db/seed.sql` to ensure the `match_status` enum includes `CHALLENGED`, `PROCESSING`, and `CANCELLED`, and to create the `matches_changes` notification trigger.
2. Deploy the Edge Function located at `supabase_functions/match-notifier` with `supabase functions deploy match-notifier`.
3. Configure the following environment variables for the function:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (secure; service key)
   - `SENDGRID_API_KEY` (or SMTP settings if you modify the function)
   - `PUBLIC_SITE_URL` (site base URL used in email action links)

The Edge Function subscribes to realtime changes and handles the email sending. It uses `action_token` (added to `matches` table) to build secure email links; you can choose whether to require login for action URLs or allow token-based actions.

If you want, I can implement the accept/reject/submit/verify API endpoints and UI next — tell me if you prefer token-based email actions or require users to sign in to confirm actions.

Server endpoints have been added to the repo as templates (token-based links supported):

- `GET /api/matches/:id/action?action=accept|reject&token=...` — accept or reject a challenged match
- `POST /api/matches/:id/submit-result` — submit a result (body: `{ winner_profile_id, reported_by?, token }`)
- `GET /api/matches/:id/verify?token=...&verify=yes|no` — verify or dispute a reported result

These endpoints use the `action_token` column for token-based actions. You should secure them with authentication or additional checks for production.

Enjoy developing the Sports Ladder locally!
