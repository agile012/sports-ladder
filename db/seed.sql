-- Seed data aligned with the production schema

-- Insert sample sport (id is uuid by default in your prod schema)
insert into sports (name) values ('Badminton') on conflict (name) do nothing;

-- Insert sample player profiles (user_id is nullable for seeded demo rows)
insert into player_profiles (user_id, sport_id, rating, matches_played) values
(null, (select id from sports where name = 'Badminton'), 1650, 12) on conflict do nothing,
(null, (select id from sports where name = 'Badminton'), 1600, 8) on conflict do nothing,
(null, (select id from sports where name = 'Badminton'), 1500, 3) on conflict do nothing;

-- Insert a finished match between the seeded profiles (if profiles exist)
insert into matches (sport_id, player1_id, player2_id, winner_id, status)
values (
  (select id from sports where name = 'Badminton'),
  (select id from player_profiles where rating = 1650 limit 1),
  (select id from player_profiles where rating = 1600 limit 1),
  (select id from player_profiles where rating = 1650 limit 1),
  'finished'
) on conflict do nothing;

-- Create a view that joins player_profiles to auth.users so the frontend can display an email/avatar when available
create or replace view player_profiles_view as
select
  p.id,
  p.user_id,
  p.sport_id,
  p.rating,
  p.matches_played,
  p.created_at,
  u.email as user_email,
  u.raw_user_meta_data as user_metadata
from player_profiles p
left join auth.users u on p.user_id = u.id;

-- Ensure match_status enum has required values: add CHALLENGED, PROCESSING, CANCELLED if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE match_status AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSED');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CHALLENGED' AND enumtypid = 'match_status'::regtype) THEN
    ALTER TYPE match_status ADD VALUE 'CHALLENGED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROCESSING' AND enumtypid = 'match_status'::regtype) THEN
    ALTER TYPE match_status ADD VALUE 'PROCESSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CANCELLED' AND enumtypid = 'match_status'::regtype) THEN
    ALTER TYPE match_status ADD VALUE 'CANCELLED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DISPUTED' AND enumtypid = 'match_status'::regtype) THEN
    ALTER TYPE match_status ADD VALUE 'DISPUTED';
  END IF;
END$$;

-- Add message/winner/action_token/updated_at columns to matches table (used for challenge flow and email-action links) if not exists
ALTER TABLE IF EXISTS public.matches
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS winner_id uuid REFERENCES public.player_profiles(id),
  ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES public.player_profiles(id),
  ADD COLUMN IF NOT EXISTS action_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Helpful indexes
create index if not exists idx_matches_action_token on public.matches(action_token);
create index if not exists idx_matches_winner_id on public.matches(winner_id);
create index if not exists idx_matches_reported_by on public.matches(reported_by);

-- Ratings history table to record rating changes per profile (used to build timelines)
create table if not exists public.ratings_history (
  id uuid default gen_random_uuid() primary key,
  player_profile_id uuid not null references public.player_profiles(id),
  match_id uuid references public.matches(id),
  old_rating int,
  new_rating int,
  delta int,
  reason text,
  created_at timestamptz default now()
);
create index if not exists idx_ratings_history_player_created on public.ratings_history(player_profile_id, created_at desc);

-- Atomic function to apply a confirmed match result, update both player ratings and insert history rows in a single transaction
create or replace function public.apply_match_result(p_match_id uuid) returns jsonb as $$
declare
  m record;
  p1 record;
  p2 record;
  r1 int;
  r2 int;
  new1 int;
  new2 int;
  score1 int;
  K int := 32;
  exp1 double precision;
  exp2 double precision;
begin
  -- lock the match row
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found';
  end if;

  if m.status = 'CONFIRMED' then
    return jsonb_build_object('ok', false, 'reason', 'already_confirmed');
  end if;

  if m.winner_id is null then
    raise exception 'match has no winner set';
  end if;

  -- lock player profiles
  select id, rating into p1 from public.player_profiles where id = m.player1_id for update;
  select id, rating into p2 from public.player_profiles where id = m.player2_id for update;

  r1 := coalesce(p1.rating, 1200);
  r2 := coalesce(p2.rating, 1200);
  score1 := case when m.winner_id = p1.id then 1 else 0 end;

  exp1 := 1.0/(1.0 + power(10.0, (r2 - r1)/400.0));
  exp2 := 1.0/(1.0 + power(10.0, (r1 - r2)/400.0));

  new1 := round(r1 + K * (score1 - exp1))::int;
  new2 := round(r2 + K * ((1 - score1) - exp2))::int;

  update public.player_profiles set rating = new1 where id = p1.id;
  update public.player_profiles set rating = new2 where id = p2.id;

  insert into public.ratings_history(player_profile_id, match_id, old_rating, new_rating, delta, reason)
    values (p1.id, p_match_id, r1, new1, new1 - r1, 'Match result'),
           (p2.id, p_match_id, r2, new2, new2 - r2, 'Match result');

  update public.matches set status = 'CONFIRMED' where id = p_match_id;

  return jsonb_build_object('ok', true, 'p1', jsonb_build_object('id', p1.id, 'old', r1, 'new', new1), 'p2', jsonb_build_object('id', p2.id, 'old', r2, 'new', new2));
end;
$$ language plpgsql security definer;

-- Updated atomic ELO processor: process_match_elo(match_uuid)
-- This function computes ELO, updates both player profiles, inserts ratings_history, increments matches_played and marks the match PROCESSED
create or replace function public.process_match_elo(match_uuid uuid) returns jsonb as $$
DECLARE
  m RECORD;
  p1 RECORD;
  p2 RECORD;
  new1 integer;
  new2 integer;
  expected1 double precision;
  expected2 double precision;
  K constant integer := 32;
  old1 integer;
  old2 integer;
BEGIN
  -- Lock match row
  SELECT * INTO m FROM public.matches WHERE id = match_uuid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match not found';
  END IF;

  -- Only process matches that are CONFIRMED and not already PROCESSED
  IF m.status IS DISTINCT FROM 'CONFIRMED'::match_status THEN
    RAISE EXCEPTION 'match status is not CONFIRMED';
  END IF;

  IF m.winner_id IS NULL THEN
    RAISE EXCEPTION 'match has no winner';
  END IF;

  -- Lock player rows
  SELECT id, rating, matches_played INTO p1 FROM public.player_profiles WHERE id = m.player1_id FOR UPDATE;
  SELECT id, rating, matches_played INTO p2 FROM public.player_profiles WHERE id = m.player2_id FOR UPDATE;

  IF p1 IS NULL OR p2 IS NULL THEN
    RAISE EXCEPTION 'player not found';
  END IF;

  -- Ensure default rating if NULL
  IF p1.rating IS NULL THEN p1.rating := 1000; END IF;
  IF p2.rating IS NULL THEN p2.rating := 1000; END IF;

  old1 := p1.rating;
  old2 := p2.rating;

  -- ELO math
  expected1 := 1.0 / (1.0 + power(10.0, (p2.rating - p1.rating) / 400.0));
  expected2 := 1.0 / (1.0 + power(10.0, (p1.rating - p2.rating) / 400.0));

  new1 := round(p1.rating + K * ((CASE WHEN m.winner_id = p1.id THEN 1 ELSE 0 END) - expected1))::int;
  new2 := round(p2.rating + K * ((CASE WHEN m.winner_id = p2.id THEN 1 ELSE 0 END) - expected2))::int;

  -- Update player ratings and increment matches_played
  UPDATE public.player_profiles
    SET rating = new1,
        matches_played = COALESCE(matches_played, 0) + 1
    WHERE id = p1.id;

  UPDATE public.player_profiles
    SET rating = new2,
        matches_played = COALESCE(matches_played, 0) + 1
    WHERE id = p2.id;

  -- Record rating history rows
  INSERT INTO public.ratings_history(player_profile_id, match_id, old_rating, new_rating, delta, reason)
    VALUES (p1.id, match_uuid, old1, new1, new1 - old1, 'Match result'),
           (p2.id, match_uuid, old2, new2, new2 - old2, 'Match result');

  -- Mark match processed
  UPDATE public.matches
    SET status = 'PROCESSED'::match_status
    WHERE id = m.id;

  RETURN jsonb_build_object(
    'match_id', m.id,
    'player1', jsonb_build_object('id', p1.id, 'old', old1, 'new', new1),
    'player2', jsonb_build_object('id', p2.id, 'old', old2, 'new', new2)
  );
END;
$$ language plpgsql security definer;

-- Prevent duplicate active challenges between the same pair of players for the same sport
-- This uses LEAST/GREATEST on the player ids (cast to text) to create an unordered pair key
create unique index if not exists idx_matches_unique_active_pair on public.matches(
  (least(player1_id::text, player2_id::text)),
  (greatest(player1_id::text, player2_id::text))
) where status in ('CHALLENGED','PENDING','PROCESSING');

-- Trigger to keep updated_at current on updates
create or replace function public.update_updated_at_column() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_set_updated_at on public.matches;
create trigger trg_set_updated_at
  before update on public.matches
  for each row execute procedure public.update_updated_at_column();

-- Trigger function to notify application when a match is inserted or updated
create or replace function public.notify_matches() returns trigger as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'action', TG_OP,
    'table', TG_TABLE_NAME,
    'data', to_jsonb(NEW)
  );
  perform pg_notify('matches_changes', payload::text);
  return NEW;
end;
$$ language plpgsql security definer;

-- Attach trigger to matches
drop trigger if exists trg_notify_matches on public.matches;
create trigger trg_notify_matches
  after insert or update on public.matches
  for each row execute procedure public.notify_matches();

-- Note: Run this SQL in Supabase SQL editor (it uses functions like gen_random_uuid in production)
