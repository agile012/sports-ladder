create extension if not exists "pg_cron" with schema "pg_catalog";

create type "public"."match_status" as enum ('PENDING', 'CONFIRMED', 'PROCESSED', 'CHALLENGED', 'PROCESSING', 'CANCELLED', 'DISPUTED');


  create table "public"."matches" (
    "id" uuid not null default gen_random_uuid(),
    "sport_id" uuid,
    "player1_id" uuid,
    "player2_id" uuid,
    "winner_id" uuid,
    "created_at" timestamp without time zone default now(),
    "status" public.match_status default 'PENDING'::public.match_status,
    "action_token" uuid default gen_random_uuid(),
    "message" text,
    "updated_at" timestamp with time zone default now(),
    "reported_by" uuid
      );



  create table "public"."player_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "sport_id" uuid,
    "rating" integer default 1000,
    "matches_played" integer default 0,
    "created_at" timestamp without time zone default now(),
    "deactivated" boolean not null default false
      );


alter table "public"."player_profiles" enable row level security;


  create table "public"."ratings_history" (
    "id" uuid not null default gen_random_uuid(),
    "player_profile_id" uuid not null,
    "match_id" uuid,
    "old_rating" integer,
    "new_rating" integer,
    "delta" integer,
    "reason" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."sports" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null
      );


CREATE INDEX idx_matches_action_token ON public.matches USING btree (action_token);

CREATE INDEX idx_matches_reported_by ON public.matches USING btree (reported_by);

CREATE UNIQUE INDEX idx_matches_unique_active_pair ON public.matches USING btree (LEAST((player1_id)::text, (player2_id)::text), GREATEST((player1_id)::text, (player2_id)::text)) WHERE (status = ANY (ARRAY['CHALLENGED'::public.match_status, 'PENDING'::public.match_status, 'PROCESSING'::public.match_status]));

CREATE INDEX idx_matches_winner_id ON public.matches USING btree (winner_id);

CREATE INDEX idx_player_profiles_deactivated ON public.player_profiles USING btree (deactivated);

CREATE INDEX idx_ratings_history_player_created ON public.ratings_history USING btree (player_profile_id, created_at DESC);

CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id);

CREATE UNIQUE INDEX player_profiles_pkey ON public.player_profiles USING btree (id);

CREATE UNIQUE INDEX player_profiles_user_id_sport_id_key ON public.player_profiles USING btree (user_id, sport_id);

CREATE UNIQUE INDEX ratings_history_pkey ON public.ratings_history USING btree (id);

CREATE UNIQUE INDEX sports_name_key ON public.sports USING btree (name);

CREATE UNIQUE INDEX sports_pkey ON public.sports USING btree (id);

alter table "public"."matches" add constraint "matches_pkey" PRIMARY KEY using index "matches_pkey";

alter table "public"."player_profiles" add constraint "player_profiles_pkey" PRIMARY KEY using index "player_profiles_pkey";

alter table "public"."ratings_history" add constraint "ratings_history_pkey" PRIMARY KEY using index "ratings_history_pkey";

alter table "public"."sports" add constraint "sports_pkey" PRIMARY KEY using index "sports_pkey";

alter table "public"."matches" add constraint "matches_player1_id_fkey" FOREIGN KEY (player1_id) REFERENCES public.player_profiles(id) not valid;

alter table "public"."matches" validate constraint "matches_player1_id_fkey";

alter table "public"."matches" add constraint "matches_player2_id_fkey" FOREIGN KEY (player2_id) REFERENCES public.player_profiles(id) not valid;

alter table "public"."matches" validate constraint "matches_player2_id_fkey";

alter table "public"."matches" add constraint "matches_reported_by_fkey" FOREIGN KEY (reported_by) REFERENCES public.player_profiles(id) not valid;

alter table "public"."matches" validate constraint "matches_reported_by_fkey";

alter table "public"."matches" add constraint "matches_sport_id_fkey" FOREIGN KEY (sport_id) REFERENCES public.sports(id) not valid;

alter table "public"."matches" validate constraint "matches_sport_id_fkey";

alter table "public"."matches" add constraint "matches_winner_id_fkey" FOREIGN KEY (winner_id) REFERENCES public.player_profiles(id) not valid;

alter table "public"."matches" validate constraint "matches_winner_id_fkey";

alter table "public"."player_profiles" add constraint "player_profiles_sport_id_fkey" FOREIGN KEY (sport_id) REFERENCES public.sports(id) not valid;

alter table "public"."player_profiles" validate constraint "player_profiles_sport_id_fkey";

alter table "public"."player_profiles" add constraint "player_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."player_profiles" validate constraint "player_profiles_user_id_fkey";

alter table "public"."player_profiles" add constraint "player_profiles_user_id_sport_id_key" UNIQUE using index "player_profiles_user_id_sport_id_key";

alter table "public"."ratings_history" add constraint "ratings_history_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) not valid;

alter table "public"."ratings_history" validate constraint "ratings_history_match_id_fkey";

alter table "public"."ratings_history" add constraint "ratings_history_player_profile_id_fkey" FOREIGN KEY (player_profile_id) REFERENCES public.player_profiles(id) not valid;

alter table "public"."ratings_history" validate constraint "ratings_history_player_profile_id_fkey";

alter table "public"."sports" add constraint "sports_name_key" UNIQUE using index "sports_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_replace_action_token_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Only run when status actually changed (trigger WHEN also guards, but keep defensive check)
  IF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.matches
      SET action_token = gen_random_uuid(),
          updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$
;

create or replace view "public"."player_profiles_view" as  SELECT p.id,
    p.user_id,
    p.sport_id,
    p.rating,
    p.matches_played,
    p.created_at,
    u.email AS user_email,
    u.raw_user_meta_data AS user_metadata,
    COALESCE((u.raw_user_meta_data ->> 'full_name'::text), ((u.raw_user_meta_data -> 'user_metadata'::text) ->> 'full_name'::text), (u.email)::text) AS full_name,
    COALESCE((u.raw_user_meta_data ->> 'avatar_url'::text), ((u.raw_user_meta_data -> 'user_metadata'::text) ->> 'avatar_url'::text)) AS avatar_url
   FROM (public.player_profiles p
     LEFT JOIN auth.users u ON ((p.user_id = u.id)))
  WHERE (COALESCE(p.deactivated, false) = false);


CREATE OR REPLACE FUNCTION public.process_match_elo(match_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  p1_already boolean;
  p2_already boolean;
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

  -- Check if this match already has ratings_history for each player
  SELECT EXISTS (
    SELECT 1 FROM public.ratings_history rh WHERE rh.match_id = match_uuid AND rh.player_profile_id = m.player1_id
  ) INTO p1_already;

  SELECT EXISTS (
    SELECT 1 FROM public.ratings_history rh WHERE rh.match_id = match_uuid AND rh.player_profile_id = m.player2_id
  ) INTO p2_already;

  -- If both players already processed for this match, skip entirely
  IF p1_already AND p2_already THEN
    RETURN jsonb_build_object(
      'match_id', m.id,
      'player1', jsonb_build_object('id', p1.id, 'old', old1, 'new', new1),
      'player2', jsonb_build_object('id', p2.id, 'old', old2, 'new', new2)
    );
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
$function$
;

CREATE OR REPLACE FUNCTION public.reactivate_profile_on_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Reactivate player1 and player2 if they exist
  IF NEW.player1_id IS NOT NULL THEN
    UPDATE public.player_profiles SET deactivated = false WHERE id = NEW.player1_id;
  END IF;

  IF NEW.player2_id IS NOT NULL THEN
    UPDATE public.player_profiles SET deactivated = false WHERE id = NEW.player2_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_all_elos_and_history(in_starting_rating integer DEFAULT 1000, in_k_factor numeric DEFAULT 32)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  ratings_map     jsonb := '{}'::jsonb; -- player_id -> rating
  played_map      jsonb := '{}'::jsonb; -- player_id -> matches_played (integer)
  m_rec           RECORD;
  player1_rating  numeric;
  player2_rating  numeric;
  expected1       numeric;
  expected2       numeric;
  actual1         numeric;
  actual2         numeric;
  new_rating1     numeric;
  new_rating2     numeric;
  old_rating1     integer;
  old_rating2     integer;
  exists_p1       boolean;
  exists_p2       boolean;
  cur_played      integer;
  hist_created_at timestamptz;
BEGIN
  -- Reset all player_profiles to defaults before recompute
  UPDATE public.player_profiles
  SET rating = in_starting_rating,
      matches_played = 0
  WHERE true;

  -- Initialize maps from current player_profiles
  FOR m_rec IN
    SELECT id, COALESCE(rating, in_starting_rating) AS rating, COALESCE(matches_played, 0) AS matches_played
    FROM public.player_profiles
  LOOP
    ratings_map := jsonb_set(ratings_map, ARRAY[m_rec.id::text], to_jsonb(m_rec.rating));
    played_map  := jsonb_set(played_map,  ARRAY[m_rec.id::text], to_jsonb(m_rec.matches_played));
  END LOOP;

  -- Truncate ratings_history to rewrite it
  TRUNCATE TABLE public.ratings_history RESTART IDENTITY;

  -- Iterate matches chronologically
  FOR m_rec IN
    SELECT id, created_at, updated_at, player1_id, player2_id, winner_id
    FROM public.matches
    WHERE player1_id IS NOT NULL AND player2_id IS NOT NULL
      AND winner_id IS NOT NULL
    ORDER BY COALESCE(created_at, now()), id
  LOOP
    -- Use match.updated_at as the created_at for history rows (fallback to created_at or now())
    hist_created_at := COALESCE(m_rec.updated_at, m_rec.created_at, now());

    -- Fetch current ratings from map or default
    player1_rating := COALESCE( (ratings_map ->> m_rec.player1_id::text)::numeric, in_starting_rating );
    player2_rating := COALESCE( (ratings_map ->> m_rec.player2_id::text)::numeric, in_starting_rating );

    -- Check if history already contains this match for these players (defensive - usually false after TRUNCATE)
    SELECT EXISTS (
      SELECT 1 FROM public.ratings_history rh WHERE rh.player_profile_id = m_rec.player1_id AND rh.match_id = m_rec.id
    ) INTO exists_p1;

    SELECT EXISTS (
      SELECT 1 FROM public.ratings_history rh WHERE rh.player_profile_id = m_rec.player2_id AND rh.match_id = m_rec.id
    ) INTO exists_p2;

    old_rating1 := ROUND(player1_rating)::integer;
    old_rating2 := ROUND(player2_rating)::integer;

    -- Expected scores
    expected1 := 1.0 / (1.0 + power(10.0, (player2_rating - player1_rating) / 400.0));
    expected2 := 1.0 / (1.0 + power(10.0, (player1_rating - player2_rating) / 400.0));

    -- Actual scores
    IF m_rec.winner_id = m_rec.player1_id THEN
      actual1 := 1.0; actual2 := 0.0;
    ELSIF m_rec.winner_id = m_rec.player2_id THEN
      actual1 := 0.0; actual2 := 1.0;
    ELSE
      actual1 := 0.5; actual2 := 0.5;
    END IF;

    -- Compute new ratings and update maps only for players without existing history for this match
    IF NOT exists_p1 THEN
      new_rating1 := player1_rating + in_k_factor * (actual1 - expected1);
      new_rating1 := GREATEST(0, ROUND(new_rating1));
      ratings_map := jsonb_set(ratings_map, ARRAY[m_rec.player1_id::text], to_jsonb(new_rating1));

      -- increment played count for player1
      cur_played := COALESCE( (played_map ->> m_rec.player1_id::text)::integer, 0 );
      cur_played := cur_played + 1;
      played_map := jsonb_set(played_map, ARRAY[m_rec.player1_id::text], to_jsonb(cur_played));
    ELSE
      new_rating1 := ROUND(player1_rating);
    END IF;

    IF NOT exists_p2 THEN
      new_rating2 := player2_rating + in_k_factor * (actual2 - expected2);
      new_rating2 := GREATEST(0, ROUND(new_rating2));
      ratings_map := jsonb_set(ratings_map, ARRAY[m_rec.player2_id::text], to_jsonb(new_rating2));

      -- increment played count for player2
      cur_played := COALESCE( (played_map ->> m_rec.player2_id::text)::integer, 0 );
      cur_played := cur_played + 1;
      played_map := jsonb_set(played_map, ARRAY[m_rec.player2_id::text], to_jsonb(cur_played));
    ELSE
      new_rating2 := ROUND(player2_rating);
    END IF;

    -- Insert history rows only for players that were not already recorded; use hist_created_at
    IF NOT exists_p1 AND NOT exists_p2 THEN
      INSERT INTO public.ratings_history(id, player_profile_id, match_id, old_rating, new_rating, delta, reason, created_at)
      VALUES
        (gen_random_uuid(), m_rec.player1_id, m_rec.id, old_rating1, new_rating1::integer, (new_rating1::integer - old_rating1), 'recomputed', hist_created_at),
        (gen_random_uuid(), m_rec.player2_id, m_rec.id, old_rating2, new_rating2::integer, (new_rating2::integer - old_rating2), 'recomputed', hist_created_at);
    ELSIF NOT exists_p1 THEN
      INSERT INTO public.ratings_history(id, player_profile_id, match_id, old_rating, new_rating, delta, reason, created_at)
      VALUES
        (gen_random_uuid(), m_rec.player1_id, m_rec.id, old_rating1, new_rating1::integer, (new_rating1::integer - old_rating1), 'recomputed', hist_created_at);
    ELSIF NOT exists_p2 THEN
      INSERT INTO public.ratings_history(id, player_profile_id, match_id, old_rating, new_rating, delta, reason, created_at)
      VALUES
        (gen_random_uuid(), m_rec.player2_id, m_rec.id, old_rating2, new_rating2::integer, (new_rating2::integer - old_rating2), 'recomputed', hist_created_at);
    END IF;
  END LOOP;

  -- Persist final ratings back to player_profiles
  WITH final_ratings AS (
    SELECT (key::uuid) AS player_id, (value::text)::integer AS final_rating
    FROM jsonb_each(ratings_map)
  )
  UPDATE public.player_profiles p
  SET rating = fr.final_rating
  FROM final_ratings fr
  WHERE p.id = fr.player_id;

  -- Persist matches_played back to player_profiles
  WITH final_played AS (
    SELECT (key::uuid) AS player_id, (value::text)::integer AS matches_played
    FROM jsonb_each(played_map)
  )
  UPDATE public.player_profiles p
  SET matches_played = fp.matches_played
  FROM final_played fp
  WHERE p.id = fp.player_id;

  RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_process_match_elo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  res jsonb;
BEGIN
  -- Only act when status transitions to CONFIRMED
  IF (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status = 'CONFIRMED'::match_status THEN
    BEGIN
      -- Call the processing function
      res := process_match_elo(NEW.id);
      -- Optional: insert res into an audit table
    EXCEPTION WHEN others THEN
      -- By default, log a NOTICE and do not abort the update that set CONFIRMED.
      -- Change to RAISE to abort the outer transaction on failure.
      RAISE NOTICE 'ELO processing failed for match %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

grant delete on table "public"."matches" to "anon";

grant insert on table "public"."matches" to "anon";

grant references on table "public"."matches" to "anon";

grant select on table "public"."matches" to "anon";

grant trigger on table "public"."matches" to "anon";

grant truncate on table "public"."matches" to "anon";

grant update on table "public"."matches" to "anon";

grant delete on table "public"."matches" to "authenticated";

grant insert on table "public"."matches" to "authenticated";

grant references on table "public"."matches" to "authenticated";

grant select on table "public"."matches" to "authenticated";

grant trigger on table "public"."matches" to "authenticated";

grant truncate on table "public"."matches" to "authenticated";

grant update on table "public"."matches" to "authenticated";

grant delete on table "public"."matches" to "service_role";

grant insert on table "public"."matches" to "service_role";

grant references on table "public"."matches" to "service_role";

grant select on table "public"."matches" to "service_role";

grant trigger on table "public"."matches" to "service_role";

grant truncate on table "public"."matches" to "service_role";

grant update on table "public"."matches" to "service_role";

grant delete on table "public"."player_profiles" to "anon";

grant insert on table "public"."player_profiles" to "anon";

grant references on table "public"."player_profiles" to "anon";

grant select on table "public"."player_profiles" to "anon";

grant trigger on table "public"."player_profiles" to "anon";

grant truncate on table "public"."player_profiles" to "anon";

grant update on table "public"."player_profiles" to "anon";

grant delete on table "public"."player_profiles" to "authenticated";

grant insert on table "public"."player_profiles" to "authenticated";

grant references on table "public"."player_profiles" to "authenticated";

grant select on table "public"."player_profiles" to "authenticated";

grant trigger on table "public"."player_profiles" to "authenticated";

grant truncate on table "public"."player_profiles" to "authenticated";

grant update on table "public"."player_profiles" to "authenticated";

grant delete on table "public"."player_profiles" to "service_role";

grant insert on table "public"."player_profiles" to "service_role";

grant references on table "public"."player_profiles" to "service_role";

grant select on table "public"."player_profiles" to "service_role";

grant trigger on table "public"."player_profiles" to "service_role";

grant truncate on table "public"."player_profiles" to "service_role";

grant update on table "public"."player_profiles" to "service_role";

grant delete on table "public"."ratings_history" to "anon";

grant insert on table "public"."ratings_history" to "anon";

grant references on table "public"."ratings_history" to "anon";

grant select on table "public"."ratings_history" to "anon";

grant trigger on table "public"."ratings_history" to "anon";

grant truncate on table "public"."ratings_history" to "anon";

grant update on table "public"."ratings_history" to "anon";

grant delete on table "public"."ratings_history" to "authenticated";

grant insert on table "public"."ratings_history" to "authenticated";

grant references on table "public"."ratings_history" to "authenticated";

grant select on table "public"."ratings_history" to "authenticated";

grant trigger on table "public"."ratings_history" to "authenticated";

grant truncate on table "public"."ratings_history" to "authenticated";

grant update on table "public"."ratings_history" to "authenticated";

grant delete on table "public"."ratings_history" to "service_role";

grant insert on table "public"."ratings_history" to "service_role";

grant references on table "public"."ratings_history" to "service_role";

grant select on table "public"."ratings_history" to "service_role";

grant trigger on table "public"."ratings_history" to "service_role";

grant truncate on table "public"."ratings_history" to "service_role";

grant update on table "public"."ratings_history" to "service_role";

grant delete on table "public"."sports" to "anon";

grant insert on table "public"."sports" to "anon";

grant references on table "public"."sports" to "anon";

grant select on table "public"."sports" to "anon";

grant trigger on table "public"."sports" to "anon";

grant truncate on table "public"."sports" to "anon";

grant update on table "public"."sports" to "anon";

grant delete on table "public"."sports" to "authenticated";

grant insert on table "public"."sports" to "authenticated";

grant references on table "public"."sports" to "authenticated";

grant select on table "public"."sports" to "authenticated";

grant trigger on table "public"."sports" to "authenticated";

grant truncate on table "public"."sports" to "authenticated";

grant update on table "public"."sports" to "authenticated";

grant delete on table "public"."sports" to "service_role";

grant insert on table "public"."sports" to "service_role";

grant references on table "public"."sports" to "service_role";

grant select on table "public"."sports" to "service_role";

grant trigger on table "public"."sports" to "service_role";

grant truncate on table "public"."sports" to "service_role";

grant update on table "public"."sports" to "service_role";


  create policy "Players can create matches"
  on "public"."matches"
  as permissive
  for insert
  to public
with check (true);



  create policy "Players can read matches"
  on "public"."matches"
  as permissive
  for select
  to public
using (true);



  create policy "Players can update their match"
  on "public"."matches"
  as permissive
  for update
  to public
using ((auth.uid() IN ( SELECT player_profiles.user_id
   FROM public.player_profiles
  WHERE (player_profiles.id = matches.player1_id)
UNION
 SELECT player_profiles.user_id
   FROM public.player_profiles
  WHERE (player_profiles.id = matches.player2_id))));



  create policy "Anyone can read profiles"
  on "public"."player_profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Public read"
  on "public"."player_profiles"
  as permissive
  for select
  to public
using (true);



  create policy "User can insert own profile"
  on "public"."player_profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));


CREATE TRIGGER matches_after_status_trigger AFTER UPDATE OF status ON public.matches FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.trigger_process_match_elo();

CREATE TRIGGER reactivate_profile_on_match_trigger AFTER INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.reactivate_profile_on_match();

CREATE TRIGGER trg_match_replace_action_token AFTER UPDATE OF status ON public.matches FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.match_replace_action_token_on_status_change();

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


