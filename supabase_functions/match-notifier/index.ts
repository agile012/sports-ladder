/*
Supabase Edge Function (match-notifier)

Purpose:
- Listen to changes on the `matches` table and send emails for challenge lifecycle events:
  - When a new match with status 'CHALLENGED' is inserted: send an email to the opponent with Accept/Reject links
  - When a match status becomes 'PROCESSING': send verification email to the opponent to confirm the reported result

Environment variables required:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (service key) — necessary to read user emails and join views
- SENDGRID_API_KEY (or set SMTP variables if using nodemailer)
- PUBLIC_SITE_URL (e.g., https://example.com)

Deploy: `supabase functions deploy match-notifier` and run as a long-lived worker or background job.
*/

import { createClient } from '@supabase/supabase-js'
import sgMail from '@sendgrid/mail'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!
const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

sgMail.setApiKey(SENDGRID_API_KEY)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Start a realtime subscription to the matches table
async function start() {
  const channel = supabase
    .channel('realtime_matches')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, payload => {
      handleInsert(payload.record).catch(console.error)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
      handleUpdate(payload.old_record, payload.record).catch(console.error)
    })

  await channel.subscribe()
  console.log('Subscribed to matches realtime channel')
}

async function handleInsert(record: any) {
  try {
    if (record.status === 'CHALLENGED') {
      // fetch opponent user email via player_profiles_view
      const { data: opponent } = await supabase
        .from('player_profiles_view')
        .select('id, user_id, user_email, full_name')
        .eq('id', record.player2_id)
        .limit(1)
        .single()

      if (!opponent?.user_email) return

      const acceptUrl = `${PUBLIC_SITE_URL}/api/matches/${record.id}/action?action=accept&token=${record.action_token}`
      const rejectUrl = `${PUBLIC_SITE_URL}/api/matches/${record.id}/action?action=reject&token=${record.action_token}`

      const msg = {
        to: opponent.user_email,
        from: 'no-reply@example.com',
        subject: `You were challenged in ${record.sport_id}`,
        html: `
          <p><strong>${record.player1_id}</strong> has challenged you in the ladder.</p>
          <p>${record.message ?? ''}</p>
          <p><a href="${acceptUrl}">Accept</a> — <a href="${rejectUrl}">Reject</a></p>
        `
      }

      await sgMail.send(msg)
      console.log('Sent challenge email to', opponent.user_email)
    }
  } catch (err) {
    console.error('handleInsert error', err)
  }
}

async function handleUpdate(oldRec: any, newRec: any) {
  try {
    // When a CHALLENGED match is accepted (status becomes PENDING), notify the challenger
    if (oldRec?.status === 'CHALLENGED' && newRec?.status === 'PENDING') {
      const { data: challenger } = await supabase
        .from('player_profiles_view')
        .select('id, user_id, user_email, full_name')
        .eq('id', newRec.player1_id)
        .limit(1)
        .single()

      if (challenger?.user_email) {
        const msg = {
          to: challenger.user_email,
          from: 'no-reply@example.com',
          subject: `Your challenge was accepted`,
          html: `<p>Your challenge for match ${newRec.id} was accepted.</p><p>You can now enter the result in the app.</p>`
        }
        await sgMail.send(msg)
        console.log('Sent acceptance email to', challenger.user_email)
      }
    }

    // When status moves to PROCESSING, notify the opponent to verify the reported result
    if (oldRec?.status !== 'PROCESSING' && newRec?.status === 'PROCESSING') {
      // fetch opponent info to email
      const { data: opponent } = await supabase
        .from('player_profiles_view')
        .select('id, user_id, user_email, full_name')
        .eq('id', newRec.player2_id)
        .limit(1)
        .single()

      if (!opponent?.user_email) return

      const verifyUrl = `${PUBLIC_SITE_URL}/api/matches/${newRec.id}/verify?token=${newRec.action_token}`

      const msg = {
        to: opponent.user_email,
        from: 'no-reply@example.com',
        subject: `Verify match result for challenge ${newRec.id}`,
        html: `
          <p>The challenger reported a result for your match.</p>
          <p><a href="${verifyUrl}">Verify the result</a></p>
        `
      }

      await sgMail.send(msg)
      console.log('Sent verification email to', opponent.user_email)
    }
  } catch (err) {
    console.error('handleUpdate error', err)
  }
}

// Start the worker
start().catch(err => console.error('Subscription failed', err))

export {}