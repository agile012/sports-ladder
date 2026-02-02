import { createClient } from "@supabase/supabase-js";
import nodemailer from 'nodemailer';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const PUBLIC_SITE_URL =
    process.env.PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
})

export const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@example.com';
