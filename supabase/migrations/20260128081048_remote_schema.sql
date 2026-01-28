


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."match_status" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'PROCESSED',
    'CHALLENGED',
    'PROCESSING',
    'CANCELLED',
    'DISPUTED'
);


ALTER TYPE "public"."match_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_initial_ladder_rank"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  max_rank integer;
BEGIN
  -- Find current max rank for this sport
  SELECT COALESCE(MAX(ladder_rank), 0) INTO max_rank
  FROM public.player_profiles
  WHERE sport_id = NEW.sport_id;

  -- Assign next rank
  NEW.ladder_rank := max_rank + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_initial_ladder_rank"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_profile_id UUID;
    v_current_rank INTEGER;
BEGIN
    -- Get profile info
    SELECT id, ladder_rank INTO v_profile_id, v_current_rank
    FROM player_profiles
    WHERE sport_id = p_sport_id AND user_id = p_user_id;

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    IF v_current_rank IS NULL THEN
         -- Already not ranked (e.g. just joined but processed?), act as deactivate only
         UPDATE player_profiles
         SET deactivated = TRUE, deactivated_at = NOW(), ladder_rank = NULL
         WHERE id = v_profile_id;
         RETURN;
    END IF;

    -- Update the leaving player
    UPDATE player_profiles
    SET 
        deactivated = TRUE,
        deactivated_at = NOW(),
        last_active_rank = v_current_rank,
        ladder_rank = NULL
    WHERE id = v_profile_id;

    -- Shift everyone below UP by 1
    UPDATE player_profiles
    SET ladder_rank = ladder_rank - 1
    WHERE sport_id = p_sport_id 
      AND ladder_rank > v_current_rank
      AND deactivated = FALSE; -- Only active players shift? Yes.
      
    -- Record history? OPTIONAL but good for tracking.
    -- We'll assume ladder_rank_history trigger might fire on UPDATE of ladder_rank = NULL?
    -- If trigger ignores NULL, we might manually insert if needed. 
    -- For now, relying on side effects being sufficient.

END;
$$;


ALTER FUNCTION "public"."leave_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_replace_action_token_on_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."match_replace_action_token_on_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_expired_challenges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m RECORD;
  cfg jsonb;
  challenge_days integer;
  cutoff timestamptz;
  processed_count integer := 0;
  processed_matches jsonb := '[]'::jsonb;
  new_scores jsonb;
BEGIN
  FOR m IN
    SELECT *
    FROM public.matches
    WHERE status = 'CHALLENGED'::match_status
      AND player1_id IS NOT NULL
      AND created_at IS NOT NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Load sport scoring config; skip if missing
    SELECT s.scoring_config INTO cfg
    FROM public.sports s
    WHERE s.id = m.sport_id
    LIMIT 1;

    IF cfg IS NULL THEN
      CONTINUE; -- no config => do nothing
    END IF;

    -- Extract challenge_window_days; if not present or not an integer, skip
    BEGIN
      challenge_days := (cfg ->> 'challenge_window_days')::int;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    IF challenge_days IS NULL THEN
      CONTINUE;
    END IF;

    cutoff := m.created_at + (challenge_days || ' days')::interval;

    IF now() >= cutoff THEN
      -- Merge or create scores JSONB and set reason = 'forfeit'
      IF m.scores IS NULL THEN
        new_scores := jsonb_build_object('reason', 'forfeit');
      ELSE
        -- Overwrite or set the reason field
        new_scores := m.scores || jsonb_build_object('reason', 'forfeit');
      END IF;

      UPDATE public.matches
      SET winner_id = player1_id,
          scores = new_scores,
          status = 'PROCESSED'::match_status,
          updated_at = now()
      WHERE id = m.id;

      processed_matches := processed_matches || jsonb_build_object(
        'match_id', m.id,
        'player1_id', m.player1_id,
        'player2_id', m.player2_id,
        'sport_id', m.sport_id,
        'cutoff', cutoff
      );

      processed_count := processed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_count', processed_count,
    'processed_matches', processed_matches
  );
END;
$$;


ALTER FUNCTION "public"."process_expired_challenges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_ladder_match"("match_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m RECORD;
  winner_id uuid;
  loser_id uuid;
  winner_rank integer;
  loser_rank integer;
  sport_uuid uuid;
BEGIN
  -- Fetch Match Data
  SELECT * INTO m FROM public.matches WHERE id = match_uuid;
  
  IF m.winner_id IS NULL THEN
    RAISE NOTICE 'Match % has no winner, skipping ladder processing', match_uuid;
    RETURN;
  END IF;

  winner_id := m.winner_id;
  IF m.player1_id = winner_id THEN
    loser_id := m.player2_id;
  ELSE
    loser_id := m.player1_id;
  END IF;
  
  sport_uuid := m.sport_id;

  -- Get Current Ranks (Locking rows)
  SELECT ladder_rank INTO winner_rank FROM public.player_profiles WHERE id = winner_id FOR UPDATE;
  SELECT ladder_rank INTO loser_rank FROM public.player_profiles WHERE id = loser_id FOR UPDATE;

  -- LEAPFROG LOGIC
  -- Only change if Winner (Lower Rank/Higher Number) beats Loser (Higher Rank/Lower Number)
  -- Example: Winner Rank 15 beats Loser Rank 12.
  -- Winner becomes 12.
  -- Old 12 becomes 13, 13->14, 14->15.
  
  IF winner_rank > loser_rank THEN
    -- Defer constraint check if possible, or assume deferrable constraint is set
    SET CONSTRAINTS public.player_profiles_sport_rank_key DEFERRED;

    -- 1. Shift everyone between [Loser Rank, Winner Rank - 1] down by 1
    UPDATE public.player_profiles
    SET ladder_rank = ladder_rank + 1
    WHERE sport_id = sport_uuid
      AND ladder_rank >= loser_rank
      AND ladder_rank < winner_rank;

    -- 2. Move Winner to Loser's old rank
    UPDATE public.player_profiles
    SET ladder_rank = loser_rank
    WHERE id = winner_id;
    
    -- Record History
    INSERT INTO public.ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
    VALUES 
      (sport_uuid, winner_id, m.id, winner_rank, loser_rank, 'Victory: Leapfrog'),
      (sport_uuid, loser_id, m.id, loser_rank, loser_rank + 1, 'Defeat: Displaced');
      
  ELSE
    -- Higher ranked player won (or equal), do nothing to ranks
    -- Optionally record "Defended" history
    NULL;
  END IF;

END;
$$;


ALTER FUNCTION "public"."process_ladder_match"("match_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_match_elo"("match_uuid" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."process_match_elo"("match_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivate_profile_on_match"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."reactivate_profile_on_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_ladder_history"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  s RECORD;
  p RECORD;
  m RECORD;
  current_rank integer;
BEGIN
  -- 1. Reset all ranks based on Join Date (created_at) per Sport
  FOR s IN SELECT id FROM public.sports LOOP
    current_rank := 1;
    FOR p IN 
      SELECT id 
      FROM public.player_profiles 
      WHERE sport_id = s.id 
      ORDER BY created_at ASC 
    LOOP
      UPDATE public.player_profiles
      SET ladder_rank = current_rank
      WHERE id = p.id;
      
      current_rank := current_rank + 1;
    END LOOP;
  END LOOP;
  
  -- Clear History
  TRUNCATE TABLE public.ladder_rank_history;

  -- 2. Replay Matches
  FOR m IN 
    SELECT id, status, updated_at 
    FROM public.matches 
    WHERE status IN ('CONFIRMED', 'PROCESSED') 
    ORDER BY COALESCE(created_at, now()) ASC 
  LOOP
    PERFORM public.process_ladder_match(m.id);
  END LOOP;
  
END;
$$;


ALTER FUNCTION "public"."recalc_ladder_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_all_elos_and_history"("in_starting_rating" integer DEFAULT 1000, "in_k_factor" numeric DEFAULT 32) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."recompute_all_elos_and_history"("in_starting_rating" integer, "in_k_factor" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rejoin_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_profile_id UUID;
    v_last_rank INTEGER;
    v_deactivated_at TIMESTAMPTZ;
    v_weeks_away INTEGER;
    v_target_rank INTEGER;
    v_max_rank INTEGER;
BEGIN
    -- Get inactive profile
    SELECT id, last_active_rank, deactivated_at INTO v_profile_id, v_last_rank, v_deactivated_at
    FROM player_profiles
    WHERE sport_id = p_sport_id AND user_id = p_user_id AND deactivated = TRUE;

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Deactivated profile not found';
    END IF;

    -- Calculate penalty
    -- If never active/ranked before, treat as new player (bottom)?
    IF v_last_rank IS NULL THEN
         -- Just reactivate and assign to bottom
         UPDATE player_profiles SET deactivated = FALSE, deactivated_at = NULL WHERE id = v_profile_id;
         -- Trigger 'assign_initial_ladder_rank' might not fire on update, so handle manually or let it be null and handled?
         -- Let's assign max + 1
         SELECT COALESCE(MAX(ladder_rank), 0) INTO v_max_rank FROM player_profiles WHERE sport_id = p_sport_id;
         v_target_rank := v_max_rank + 1;
    ELSE
         -- Calculate weeks away (ceil)
         v_weeks_away := CEIL(EXTRACT(EPOCH FROM (NOW() - v_deactivated_at)) / 604800);
         IF v_weeks_away < 0 THEN v_weeks_away := 0; END IF;
         
         v_target_rank := v_last_rank + v_weeks_away;
         
         -- Clamp to max rank + 1
         SELECT COALESCE(MAX(ladder_rank), 0) INTO v_max_rank FROM player_profiles WHERE sport_id = p_sport_id;
         
         IF v_target_rank > v_max_rank + 1 THEN
            v_target_rank := v_max_rank + 1;
         END IF;
    END IF;

    -- Shift players DOWN to make space at v_target_rank
    UPDATE player_profiles
    SET ladder_rank = ladder_rank + 1
    WHERE sport_id = p_sport_id
      AND ladder_rank >= v_target_rank
      AND deactivated = FALSE;

    -- Activate player
    UPDATE player_profiles
    SET 
        deactivated = FALSE,
        deactivated_at = NULL,
        last_active_rank = NULL,
        ladder_rank = v_target_rank
    WHERE id = v_profile_id;

    -- Insert history record
    INSERT INTO ladder_rank_history (player_profile_id, old_rank, new_rank, match_id, reason)
    VALUES (v_profile_id, v_last_rank, v_target_rank, NULL, 'Rejoined Ladder');

    RETURN v_target_rank;
END;
$$;


ALTER FUNCTION "public"."rejoin_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_process_ladder"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'CONFIRMED' THEN
    PERFORM public.process_ladder_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_process_ladder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_process_match_elo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_process_match_elo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ladder_rank_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport_id" "uuid" NOT NULL,
    "player_profile_id" "uuid" NOT NULL,
    "match_id" "uuid",
    "old_rank" integer,
    "new_rank" integer,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ladder_rank_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport_id" "uuid",
    "player1_id" "uuid",
    "player2_id" "uuid",
    "winner_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "status" "public"."match_status" DEFAULT 'PENDING'::"public"."match_status",
    "action_token" "uuid" DEFAULT "gen_random_uuid"(),
    "message" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reported_by" "uuid",
    "scores" "jsonb"
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."matches"."scores" IS 'Actual match scores in JSON format';



CREATE TABLE IF NOT EXISTS "public"."player_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "sport_id" "uuid",
    "rating" integer DEFAULT 1000,
    "matches_played" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "deactivated" boolean DEFAULT false NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "ladder_rank" integer,
    "deactivated_at" timestamp with time zone,
    "last_active_rank" integer
);


ALTER TABLE "public"."player_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."player_profiles_view" AS
 SELECT "pp"."id",
    "pp"."user_id",
    "pp"."sport_id",
    "pp"."rating",
    "pp"."matches_played",
    "pp"."ladder_rank",
    "pp"."is_admin",
    "pp"."deactivated",
    "pp"."deactivated_at",
    "pp"."last_active_rank",
    "au"."email" AS "user_email",
    "au"."raw_user_meta_data" AS "user_metadata",
    COALESCE(("au"."raw_user_meta_data" ->> 'full_name'::"text"), ("au"."raw_user_meta_data" ->> 'name'::"text"), ("au"."email")::"text") AS "full_name",
    ("au"."raw_user_meta_data" ->> 'avatar_url'::"text") AS "avatar_url"
   FROM ("public"."player_profiles" "pp"
     JOIN "auth"."users" "au" ON (("pp"."user_id" = "au"."id")))
  WHERE ("pp"."deactivated" = false);


ALTER VIEW "public"."player_profiles_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_profile_id" "uuid" NOT NULL,
    "match_id" "uuid",
    "old_rating" integer,
    "new_rating" integer,
    "delta" integer,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ratings_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "scoring_config" "jsonb" DEFAULT '{"type": "simple"}'::"jsonb"
);


ALTER TABLE "public"."sports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sports"."scoring_config" IS 'Configuration for scoring rules (e.g. sets, points, win_by)';



ALTER TABLE ONLY "public"."ladder_rank_history"
    ADD CONSTRAINT "ladder_rank_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_sport_rank_key" UNIQUE ("sport_id", "ladder_rank") DEFERRABLE;



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_user_id_sport_id_key" UNIQUE ("user_id", "sport_id");



ALTER TABLE ONLY "public"."ratings_history"
    ADD CONSTRAINT "ratings_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sports"
    ADD CONSTRAINT "sports_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."sports"
    ADD CONSTRAINT "sports_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_matches_action_token" ON "public"."matches" USING "btree" ("action_token");



CREATE INDEX "idx_matches_reported_by" ON "public"."matches" USING "btree" ("reported_by");



CREATE UNIQUE INDEX "idx_matches_unique_active_pair" ON "public"."matches" USING "btree" (LEAST(("player1_id")::"text", ("player2_id")::"text"), GREATEST(("player1_id")::"text", ("player2_id")::"text")) WHERE ("status" = ANY (ARRAY['CHALLENGED'::"public"."match_status", 'PENDING'::"public"."match_status", 'PROCESSING'::"public"."match_status"]));



CREATE INDEX "idx_matches_winner_id" ON "public"."matches" USING "btree" ("winner_id");



CREATE INDEX "idx_player_profiles_deactivated" ON "public"."player_profiles" USING "btree" ("deactivated");



CREATE INDEX "idx_ratings_history_player_created" ON "public"."ratings_history" USING "btree" ("player_profile_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "matches_after_status_trigger" AFTER UPDATE OF "status" ON "public"."matches" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."trigger_process_match_elo"();



CREATE OR REPLACE TRIGGER "matches_ladder_update_trigger" AFTER UPDATE OF "status" ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_process_ladder"();



CREATE OR REPLACE TRIGGER "reactivate_profile_on_match_trigger" AFTER INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."reactivate_profile_on_match"();



CREATE OR REPLACE TRIGGER "trg_assign_ladder_rank" BEFORE INSERT ON "public"."player_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."assign_initial_ladder_rank"();



CREATE OR REPLACE TRIGGER "trg_match_replace_action_token" AFTER UPDATE OF "status" ON "public"."matches" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."match_replace_action_token_on_status_change"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ladder_rank_history"
    ADD CONSTRAINT "ladder_rank_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."ladder_rank_history"
    ADD CONSTRAINT "ladder_rank_history_player_profile_id_fkey" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id");



ALTER TABLE ONLY "public"."ladder_rank_history"
    ADD CONSTRAINT "ladder_rank_history_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "public"."player_profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "public"."player_profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."player_profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."player_profiles"("id");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ratings_history"
    ADD CONSTRAINT "ratings_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."ratings_history"
    ADD CONSTRAINT "ratings_history_player_profile_id_fkey" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id");



CREATE POLICY "Anyone can read profiles" ON "public"."player_profiles" FOR SELECT USING (true);



CREATE POLICY "Players can create matches" ON "public"."matches" FOR INSERT WITH CHECK (true);



CREATE POLICY "Players can read matches" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "Players can update their match" ON "public"."matches" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "player_profiles"."user_id"
   FROM "public"."player_profiles"
  WHERE ("player_profiles"."id" = "matches"."player1_id")
UNION
 SELECT "player_profiles"."user_id"
   FROM "public"."player_profiles"
  WHERE ("player_profiles"."id" = "matches"."player2_id"))));



CREATE POLICY "Public read" ON "public"."player_profiles" FOR SELECT USING (true);



CREATE POLICY "User can insert own profile" ON "public"."player_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."assign_initial_ladder_rank"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_initial_ladder_rank"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_initial_ladder_rank"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_replace_action_token_on_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."match_replace_action_token_on_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_replace_action_token_on_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_expired_challenges"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_expired_challenges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_expired_challenges"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_ladder_match"("match_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_ladder_match"("match_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_ladder_match"("match_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_match_elo"("match_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_match_elo"("match_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_match_elo"("match_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_match_elo"("match_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_profile_on_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_profile_on_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_profile_on_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_ladder_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_ladder_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_ladder_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_all_elos_and_history"("in_starting_rating" integer, "in_k_factor" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_all_elos_and_history"("in_starting_rating" integer, "in_k_factor" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_all_elos_and_history"("in_starting_rating" integer, "in_k_factor" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."rejoin_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rejoin_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rejoin_ladder"("p_sport_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_ladder"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_ladder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_ladder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_match_elo"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_match_elo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_match_elo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."ladder_rank_history" TO "anon";
GRANT ALL ON TABLE "public"."ladder_rank_history" TO "authenticated";
GRANT ALL ON TABLE "public"."ladder_rank_history" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."player_profiles" TO "anon";
GRANT ALL ON TABLE "public"."player_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."player_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."player_profiles_view" TO "anon";
GRANT ALL ON TABLE "public"."player_profiles_view" TO "authenticated";
GRANT ALL ON TABLE "public"."player_profiles_view" TO "service_role";



GRANT ALL ON TABLE "public"."ratings_history" TO "anon";
GRANT ALL ON TABLE "public"."ratings_history" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings_history" TO "service_role";



GRANT ALL ON TABLE "public"."sports" TO "anon";
GRANT ALL ON TABLE "public"."sports" TO "authenticated";
GRANT ALL ON TABLE "public"."sports" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































