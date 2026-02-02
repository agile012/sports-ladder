create extension if not exists "pg_cron" with schema "pg_catalog";

create type "public"."match_status" as enum ('PENDING', 'CONFIRMED', 'PROCESSED', 'CHALLENGED', 'PROCESSING', 'CANCELLED', 'DISPUTED');

create type "public"."verification_status" as enum ('pending', 'verified', 'rejected');


  create table "public"."ladder_rank_history" (
    "id" uuid not null default gen_random_uuid(),
    "sport_id" uuid not null,
    "player_profile_id" uuid not null,
    "match_id" uuid,
    "old_rank" integer,
    "new_rank" integer,
    "reason" text,
    "created_at" timestamp with time zone default now()
      );



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
    "reported_by" uuid,
    "scores" jsonb
      );



  create table "public"."player_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "sport_id" uuid,
    "rating" integer default 1000,
    "matches_played" integer default 0,
    "created_at" timestamp without time zone default now(),
    "deactivated" boolean not null default false,
    "is_admin" boolean not null default false,
    "ladder_rank" integer,
    "deactivated_at" timestamp with time zone,
    "last_active_rank" integer,
    "contact_number" text,
    "last_penalty_at" timestamp with time zone
      );



  create table "public"."profiles" (
    "id" uuid not null,
    "email" text not null,
    "status" public.verification_status not null default 'pending'::public.verification_status,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "subscription" jsonb not null,
    "created_at" timestamp with time zone not null default now()
      );



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
    "name" text not null,
    "scoring_config" jsonb default '{"type": "simple"}'::jsonb,
    "is_paused" boolean default false
      );


CREATE INDEX idx_matches_action_token ON public.matches USING btree (action_token);

CREATE INDEX idx_matches_reported_by ON public.matches USING btree (reported_by);

CREATE UNIQUE INDEX idx_matches_unique_active_pair ON public.matches USING btree (LEAST((player1_id)::text, (player2_id)::text), GREATEST((player1_id)::text, (player2_id)::text)) WHERE (status = ANY (ARRAY['CHALLENGED'::public.match_status, 'PENDING'::public.match_status, 'PROCESSING'::public.match_status]));

CREATE INDEX idx_matches_winner_id ON public.matches USING btree (winner_id);

CREATE INDEX idx_player_profiles_deactivated ON public.player_profiles USING btree (deactivated);

CREATE INDEX idx_ratings_history_player_created ON public.ratings_history USING btree (player_profile_id, created_at DESC);

CREATE UNIQUE INDEX ladder_rank_history_pkey ON public.ladder_rank_history USING btree (id);

CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id);

CREATE UNIQUE INDEX player_profiles_pkey ON public.player_profiles USING btree (id);

CREATE UNIQUE INDEX player_profiles_sport_rank_key ON public.player_profiles USING btree (sport_id, ladder_rank);

CREATE UNIQUE INDEX player_profiles_user_id_sport_id_key ON public.player_profiles USING btree (user_id, sport_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id);

CREATE UNIQUE INDEX push_subscriptions_user_id_subscription_key ON public.push_subscriptions USING btree (user_id, subscription);

CREATE UNIQUE INDEX ratings_history_pkey ON public.ratings_history USING btree (id);

CREATE UNIQUE INDEX sports_name_key ON public.sports USING btree (name);

CREATE UNIQUE INDEX sports_pkey ON public.sports USING btree (id);

alter table "public"."ladder_rank_history" add constraint "ladder_rank_history_pkey" PRIMARY KEY using index "ladder_rank_history_pkey";

alter table "public"."matches" add constraint "matches_pkey" PRIMARY KEY using index "matches_pkey";

alter table "public"."player_profiles" add constraint "player_profiles_pkey" PRIMARY KEY using index "player_profiles_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY using index "push_subscriptions_pkey";

alter table "public"."ratings_history" add constraint "ratings_history_pkey" PRIMARY KEY using index "ratings_history_pkey";

alter table "public"."sports" add constraint "sports_pkey" PRIMARY KEY using index "sports_pkey";

alter table "public"."ladder_rank_history" add constraint "ladder_rank_history_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) not valid;

alter table "public"."ladder_rank_history" validate constraint "ladder_rank_history_match_id_fkey";

alter table "public"."ladder_rank_history" add constraint "ladder_rank_history_player_profile_id_fkey" FOREIGN KEY (player_profile_id) REFERENCES public.player_profiles(id) not valid;

alter table "public"."ladder_rank_history" validate constraint "ladder_rank_history_player_profile_id_fkey";

alter table "public"."ladder_rank_history" add constraint "ladder_rank_history_sport_id_fkey" FOREIGN KEY (sport_id) REFERENCES public.sports(id) not valid;

alter table "public"."ladder_rank_history" validate constraint "ladder_rank_history_sport_id_fkey";

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

alter table "public"."player_profiles" add constraint "player_profiles_sport_rank_key" UNIQUE using index "player_profiles_sport_rank_key" DEFERRABLE;

alter table "public"."player_profiles" add constraint "player_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."player_profiles" validate constraint "player_profiles_user_id_fkey";

alter table "public"."player_profiles" add constraint "player_profiles_user_id_sport_id_key" UNIQUE using index "player_profiles_user_id_sport_id_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."push_subscriptions" validate constraint "push_subscriptions_user_id_fkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_subscription_key" UNIQUE using index "push_subscriptions_user_id_subscription_key";

alter table "public"."ratings_history" add constraint "ratings_history_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) not valid;

alter table "public"."ratings_history" validate constraint "ratings_history_match_id_fkey";

alter table "public"."ratings_history" add constraint "ratings_history_player_profile_id_fkey" FOREIGN KEY (player_profile_id) REFERENCES public.player_profiles(id) not valid;

alter table "public"."ratings_history" validate constraint "ratings_history_player_profile_id_fkey";

alter table "public"."sports" add constraint "sports_name_key" UNIQUE using index "sports_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_initial_ladder_rank()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  max_rank integer;
BEGIN
  -- Only assign if no rank provided on insert
  IF NEW.ladder_rank IS NULL THEN
    -- Find current max rank for this sport
    SELECT COALESCE(MAX(ladder_rank), 0) INTO max_rank
    FROM public.player_profiles
    WHERE sport_id = NEW.sport_id;

    -- Assign next rank
    NEW.ladder_rank := max_rank + 1;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_ladder_inactivity()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    s RECORD;
    p RECORD;
    last_match_date TIMESTAMPTZ;
    penalty_days INT;
    removal_days INT;
    penalty_rank_drop INT;
    days_inactive INT;
    penalty_base_date TIMESTAMPTZ;
    days_since_base INT;
    
    current_rank INT;
    new_rank INT;
    max_rank INT;
BEGIN
    -- Defer the unique constraint to allow swapping/shifting ranks without unique violation
    SET CONSTRAINTS "player_profiles_sport_rank_key" DEFERRED;

    -- Loop through all sports
    FOR s IN SELECT id, scoring_config FROM public.sports LOOP
        -- Extract config
        penalty_days := (s.scoring_config->>'penalty_days')::INT;
        removal_days := (s.scoring_config->>'removal_days')::INT;
        penalty_rank_drop := (s.scoring_config->>'penalty_rank_drop')::INT;

        -- Default values if not set
        IF penalty_days IS NULL THEN penalty_days := 14; END IF;
        IF removal_days IS NULL THEN removal_days := 42; END IF;
        IF penalty_rank_drop IS NULL THEN penalty_rank_drop := 5; END IF;

        -- Get Max Rank for bounds checking
        SELECT MAX(ladder_rank) INTO max_rank FROM public.player_profiles WHERE sport_id = s.id AND deactivated = false;
        IF max_rank IS NULL THEN max_rank := 0; END IF;

        -- Loop through active players in this sport with a rank
        -- MODIFICATION: EXCLUDE RANK 1
        FOR p IN 
            SELECT * FROM public.player_profiles 
            WHERE sport_id = s.id 
            AND deactivated = false 
            AND ladder_rank IS NOT NULL
            AND ladder_rank > 1 -- Exempt Rank 1
            ORDER BY ladder_rank DESC 
        LOOP
            -- Find last COMPLETED match date (PROCESSED or CONFIRMED)
            SELECT MAX(created_at) INTO last_match_date
            FROM public.matches
            WHERE (player1_id = p.id OR player2_id = p.id)
            AND status IN ('PROCESSED', 'CONFIRMED');

            -- If no matches, use joined_at (created_at of profile)
            IF last_match_date IS NULL THEN
                last_match_date := p.created_at;
            END IF;

            -- Calculate total inactivity
            days_inactive := EXTRACT(DAY FROM (NOW() - last_match_date));

            -- 1. Check Removal (Deactivation)
            -- Note: Rank 1 is NOT exempt from removal if they literally never play for 42+ days? 
            -- User request was "no play penalty... skip the first player... as he cannot challenge".
            -- This usually refers to the "penalty drop". Removal is usually for people who left the league.
            -- If Rank 1 is inactive for removal_days (e.g. 6 weeks), they probably should still be removed to free the spot.
            -- BUT the loop filters "ladder_rank > 1", so Rank 1 is currently skipped for BOTH.
            -- If Rank 1 is squatting, they will never be removed.
            -- However, "cannot challenge anyone" applies to *starting* matches. 
            -- If Rank 1 refuses challenges, they might be penalized by other mechanisms (forfeits).
            -- For now, the user instruction "skip the first player" is broad. I will skip both for safety based on "no obligation... to play".
            
            IF days_inactive >= removal_days THEN
                -- Deactivate player
                -- Need to shift everyone below UP
                WITH shifted AS (
                    UPDATE public.player_profiles
                    SET ladder_rank = ladder_rank - 1
                    WHERE sport_id = s.id 
                      AND ladder_rank > p.ladder_rank 
                      AND deactivated = false
                    RETURNING id, ladder_rank, (ladder_rank + 1) as old_rank
                )
                INSERT INTO public.ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
                SELECT s.id, id, NULL, old_rank, ladder_rank, 'Rank Shift (Player Removal above)'
                FROM shifted;

                UPDATE public.player_profiles
                SET deactivated = true,
                    deactivated_at = NOW(),
                    ladder_rank = NULL,
                    last_active_rank = p.ladder_rank
                WHERE id = p.id;
                
                -- Log history
                INSERT INTO public.ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
                VALUES (s.id, p.id, NULL, p.ladder_rank, NULL, 'Removed due to inactivity (' || days_inactive || ' days)');
                
                CONTINUE; -- Stop processing this player
            END IF;

            -- 2. Check Penalty (Rank Drop)
            -- Logic: Check if we are due for a penalty cycle.
            -- Base date is either last_match_date OR last_penalty_at
            
            IF p.last_penalty_at IS NOT NULL AND p.last_penalty_at > last_match_date THEN
                penalty_base_date := p.last_penalty_at;
            ELSE
                penalty_base_date := last_match_date;
            END IF;
            
            days_since_base := EXTRACT(DAY FROM (NOW() - penalty_base_date));

            IF days_since_base >= penalty_days THEN
                -- APPLY PENALTY
                current_rank := p.ladder_rank;
                new_rank := current_rank + penalty_rank_drop;
                
                -- Cap new_rank at max_rank (or number of players)
                SELECT COUNT(*) INTO max_rank FROM public.player_profiles WHERE sport_id = s.id AND deactivated = false;
                
                IF new_rank > max_rank THEN 
                    new_rank := max_rank; 
                END IF;

                IF new_rank > current_rank THEN
                    -- Perform Shift
                    
                    -- Step 1: Set penalized player to NULL rank temporarily (holds the spot conceptually)
                    UPDATE public.player_profiles SET ladder_rank = NULL WHERE id = p.id;
                    
                    -- Step 2: Shift others UP (decremant rank)
                    WITH shifted AS (
                        UPDATE public.player_profiles
                        SET ladder_rank = ladder_rank - 1
                        WHERE sport_id = s.id
                          AND deactivated = false
                          AND ladder_rank > current_rank 
                          AND ladder_rank <= new_rank
                        RETURNING id, ladder_rank, (ladder_rank + 1) as old_rank
                    )
                    INSERT INTO public.ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
                    SELECT s.id, id, NULL, old_rank, ladder_rank, 'Rank Shift (Penalty Re-org)'
                    FROM shifted;
                      
                    -- Step 3: Set penalized player to new_rank
                    UPDATE public.player_profiles 
                    SET ladder_rank = new_rank,
                        last_penalty_at = NOW()
                    WHERE id = p.id;
                    
                    -- Insert History
                    INSERT INTO public.ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
                    VALUES (s.id, p.id, NULL, current_rank, new_rank, 'Inactivity Penalty (' || days_since_base || ' days since last activity/penalty)');

                END IF;
             END IF;
        END LOOP;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_sport_paused()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF EXISTS (SELECT 1 FROM public.sports WHERE id = NEW.sport_id AND is_paused = TRUE) THEN
        RAISE EXCEPTION 'This ladder is currently paused. No new matches can be played.';
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_sport_analytics(p_sport_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_matches INTEGER;
    v_total_players INTEGER;
    v_active_players INTEGER;
    v_challenger_wins INTEGER;
    v_defender_wins INTEGER;
    v_league_pulse JSON;
    v_rating_distribution JSON;
    v_win_streaks JSON;
    v_upsets JSON;
    v_hall_of_fame_workhorse JSON;
    v_hall_of_fame_flawless JSON;
    v_hall_of_fame_fortress JSON;
    v_hall_of_fame_skyrocketing JSON;
    v_hall_of_fame_aggressor JSON;
    v_hall_of_fame_wanted JSON;
    v_rivalries JSON;
BEGIN
    SELECT COUNT(*) INTO v_total_matches FROM matches 
    WHERE sport_id = p_sport_id AND status IN ('PROCESSED', 'CONFIRMED');

    SELECT COUNT(*) INTO v_total_players FROM player_profiles
    WHERE sport_id = p_sport_id AND deactivated = FALSE;

    SELECT COUNT(DISTINCT pp.id) INTO v_active_players
    FROM player_profiles pp
    JOIN matches m ON (pp.id = m.player1_id OR pp.id = m.player2_id)
    WHERE pp.sport_id = p_sport_id 
      AND pp.deactivated = FALSE
      AND m.sport_id = p_sport_id 
      AND m.status IN ('PROCESSED', 'CONFIRMED')
      AND m.created_at >= NOW() - INTERVAL '30 days';

    SELECT COUNT(*) INTO v_challenger_wins FROM matches 
    WHERE sport_id = p_sport_id AND status IN ('PROCESSED', 'CONFIRMED') AND winner_id = player1_id;
    
    SELECT COUNT(*) INTO v_defender_wins FROM matches 
    WHERE sport_id = p_sport_id AND status IN ('PROCESSED', 'CONFIRMED') AND winner_id = player2_id;

    WITH weekly AS (
        SELECT date_trunc('week', created_at) as week_start, count(*) as count
        FROM matches
        WHERE sport_id = p_sport_id AND status IN ('PROCESSED', 'CONFIRMED')
        GROUP BY 1
        ORDER BY 1
    )
    SELECT json_agg(weekly) INTO v_league_pulse FROM weekly;

    WITH rating_buckets_raw AS (
        SELECT 
            CASE 
                WHEN rating < 900 THEN '< 900'
                WHEN rating >= 900 AND rating < 1000 THEN '900-999'
                WHEN rating >= 1000 AND rating < 1100 THEN '1000-1099'
                WHEN rating >= 1100 AND rating < 1200 THEN '1100-1199'
                WHEN rating >= 1200 AND rating < 1300 THEN '1200-1299'
                WHEN rating >= 1300 THEN '1300+'
                ELSE 'Unknown'
            END as rating_range,
            COUNT(*) as count
        FROM player_profiles
        WHERE sport_id = p_sport_id 
          AND deactivated = FALSE 
          AND rating IS NOT NULL
        GROUP BY 1
    ), rating_buckets AS (
        SELECT rating_range, count FROM rating_buckets_raw
        ORDER BY
            CASE rating_range
                WHEN '< 900' THEN 1
                WHEN '900-999' THEN 2
                WHEN '1000-1099' THEN 3
                WHEN '1100-1199' THEN 4
                WHEN '1200-1299' THEN 5
                WHEN '1300+' THEN 6
                ELSE 7
            END
    )
    SELECT json_agg(row_to_json(rating_buckets)) INTO v_rating_distribution FROM rating_buckets;

    -- Win streaks: compute row numbers and grp without nested window functions
    WITH player_matches AS (
        SELECT 
            pp.id,
            pp.full_name as name,
            pp.avatar_url as avatar,
            m.created_at,
            CASE WHEN m.winner_id = pp.id THEN 1 ELSE 0 END as won
        FROM player_profiles_view pp
        JOIN matches m ON (pp.id = m.player1_id OR pp.id = m.player2_id)
        WHERE pp.sport_id = p_sport_id 
          AND m.sport_id = p_sport_id 
          AND m.status IN ('PROCESSED', 'CONFIRMED')
    ),
    pm_numbered AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC) as rn,
               SUM(CASE WHEN won = 0 THEN 1 ELSE 0 END) OVER (PARTITION BY id ORDER BY created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as zeros_count_desc,
               SUM(CASE WHEN won = 0 THEN 1 ELSE 0 END) OVER (PARTITION BY id ORDER BY created_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as zeros_count_asc
        FROM player_matches
    ),
    -- current streak: count consecutive wins from most recent until first loss
    current_streaks AS (
        SELECT id, name, avatar, MAX(win_count) as current_streak
        FROM (
            SELECT id, name, avatar, rn, won,
                   CASE WHEN rn = 1 THEN SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) OVER (PARTITION BY id ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) END as win_count
            FROM pm_numbered
        ) s
        WHERE won = 1
        GROUP BY id, name, avatar
    ),
    -- best streaks: group by runs using zeros_count_asc to define grp
    best_streaks AS (
        SELECT id, MAX(streak_len) as best_streak
        FROM (
            SELECT id, SUM(won) as streak_len
            FROM (
                SELECT id, won, zeros_count_asc as grp
                FROM pm_numbered
            ) x
            GROUP BY id, grp
            HAVING SUM(won) > 0
        ) y
        GROUP BY id
    )
    SELECT json_agg(row_to_json(t)) INTO v_win_streaks FROM (
        SELECT 
            cs.id,
            cs.name,
            cs.avatar,
            COALESCE(cs.current_streak, 0)::int as current_streak,
            COALESCE(bs.best_streak, 0)::int as best_streak
        FROM current_streaks cs
        LEFT JOIN best_streaks bs ON cs.id = bs.id
        WHERE cs.current_streak >= 2
        ORDER BY cs.current_streak DESC, bs.best_streak DESC
        LIMIT 10
    ) t;

    -- Upsets
    WITH upsets AS (
        SELECT 
            m.id,
            m.winner_id,
            m.created_at as date,
            winner_pp.full_name as winner_name,
            winner_pp.avatar_url as winner_avatar,
            CASE WHEN m.winner_id = m.player1_id THEN lrh_w_p1.old_rank ELSE lrh_w_p2.old_rank END as winner_rank_at_time,
            loser_pp.full_name as loser_name,
            loser_pp.avatar_url as loser_avatar,
            CASE WHEN m.winner_id = m.player1_id THEN lrh_l_p2.old_rank ELSE lrh_l_p1.old_rank END as loser_rank_at_time
        FROM matches m
        JOIN player_profiles_view winner_pp ON winner_pp.id = m.winner_id
        JOIN player_profiles_view loser_pp ON loser_pp.id = CASE WHEN m.winner_id = m.player1_id THEN m.player2_id ELSE m.player1_id END
        LEFT JOIN ladder_rank_history lrh_w_p1 ON lrh_w_p1.match_id = m.id AND lrh_w_p1.player_profile_id = m.player1_id
        LEFT JOIN ladder_rank_history lrh_w_p2 ON lrh_w_p2.match_id = m.id AND lrh_w_p2.player_profile_id = m.player2_id
        LEFT JOIN ladder_rank_history lrh_l_p1 ON lrh_l_p1.match_id = m.id AND lrh_l_p1.player_profile_id = m.player1_id
        LEFT JOIN ladder_rank_history lrh_l_p2 ON lrh_l_p2.match_id = m.id AND lrh_l_p2.player_profile_id = m.player2_id
        WHERE m.sport_id = p_sport_id 
          AND m.status IN ('PROCESSED', 'CONFIRMED')
          AND m.winner_id IS NOT NULL
          AND m.created_at >= NOW() - INTERVAL '90 days'
    )
    SELECT json_agg(row_to_json(t)) INTO v_upsets FROM (
        SELECT 
            id,
            winner_id,
            winner_name,
            winner_avatar,
            winner_rank_at_time as winner_rank,
            loser_name,
            loser_avatar,
            loser_rank_at_time as loser_rank,
            (winner_rank_at_time - loser_rank_at_time) as rank_difference,
            date
        FROM upsets
        WHERE winner_rank_at_time > loser_rank_at_time
          AND (winner_rank_at_time - loser_rank_at_time) >= 3
        ORDER BY (winner_rank_at_time - loser_rank_at_time) DESC, date DESC
        LIMIT 10
    ) t;

    -- Hall of Fame and rivalries as before
    WITH workhorse AS (
        SELECT pp.id, pp.full_name, pp.avatar_url, count(m.id) as matches_count
        FROM player_profiles_view pp
        JOIN matches m ON (pp.id = m.player1_id OR pp.id = m.player2_id)
        WHERE pp.sport_id = p_sport_id AND m.sport_id = p_sport_id AND m.status IN ('PROCESSED', 'CONFIRMED')
        GROUP BY pp.id, pp.full_name, pp.avatar_url
        ORDER BY matches_count DESC
        LIMIT 5
    )
    SELECT json_agg(row_to_json(t)) INTO v_hall_of_fame_workhorse FROM (
        SELECT id, matches_count, full_name as name, avatar_url as avatar FROM workhorse
    ) t;

    WITH wins_stats AS (
        SELECT pp.id, pp.full_name, pp.avatar_url,
            COUNT(m.id) as total_matches,
            COUNT(CASE WHEN m.winner_id = pp.id THEN 1 END) as wins
        FROM player_profiles_view pp
        JOIN matches m ON (pp.id = m.player1_id OR pp.id = m.player2_id)
        WHERE pp.sport_id = p_sport_id AND m.sport_id = p_sport_id AND m.status IN ('PROCESSED', 'CONFIRMED')
        GROUP BY pp.id, pp.full_name, pp.avatar_url
        HAVING COUNT(m.id) >= 5
    )
    SELECT json_agg(row_to_json(t)) INTO v_hall_of_fame_flawless FROM (
        SELECT id, wins, total_matches, 
               ROUND((wins::numeric / total_matches::numeric) * 100, 1) as win_pct,
               full_name as name, avatar_url as avatar
        FROM wins_stats
        ORDER BY win_pct DESC, total_matches DESC
        LIMIT 5
    ) t;

    WITH defense_stats AS (
        SELECT pp.id, pp.full_name, pp.avatar_url,
            COUNT(m.id) as total_defenses,
            COUNT(CASE WHEN m.winner_id = pp.id THEN 1 END) as defense_wins
        FROM player_profiles_view pp
        JOIN matches m ON (pp.id = m.player2_id)
        WHERE pp.sport_id = p_sport_id AND m.sport_id = p_sport_id AND m.status IN ('PROCESSED', 'CONFIRMED')
        GROUP BY pp.id, pp.full_name, pp.avatar_url
        HAVING COUNT(m.id) >= 5
    )
    SELECT json_agg(row_to_json(t)) INTO v_hall_of_fame_fortress FROM (
        SELECT id, total_defenses, defense_wins,
               ROUND((defense_wins::numeric / total_defenses::numeric) * 100, 1) as defense_pct,
               full_name as name, avatar_url as avatar
        FROM defense_stats
        ORDER BY defense_pct DESC, total_defenses DESC
        LIMIT 5
    ) t;

    WITH aggressor_stats AS (
        SELECT pp.id, pp.full_name, pp.avatar_url, COUNT(m.id) as challenges_issued
        FROM player_profiles_view pp
        JOIN matches m ON pp.id = m.player1_id
        WHERE pp.sport_id = p_sport_id AND m.sport_id = p_sport_id AND m.status IN ('PROCESSED', 'CONFIRMED')
        GROUP BY pp.id, pp.full_name, pp.avatar_url
        ORDER BY challenges_issued DESC
        LIMIT 5
    )
    SELECT json_agg(row_to_json(t)) INTO v_hall_of_fame_aggressor FROM (
        SELECT id, challenges_issued, full_name as name, avatar_url as avatar FROM aggressor_stats
    ) t;

    WITH wanted_stats AS (
        SELECT pp.id, pp.full_name, pp.avatar_url, COUNT(m.id) as challenges_received
        FROM player_profiles_view pp
        JOIN matches m ON pp.id = m.player2_id
        WHERE pp.sport_id = p_sport_id AND m.sport_id = p_sport_id AND m.status IN ('PROCESSED', 'CONFIRMED')
        GROUP BY pp.id, pp.full_name, pp.avatar_url
        ORDER BY challenges_received DESC
        LIMIT 5
    )
    SELECT json_agg(row_to_json(t)) INTO v_hall_of_fame_wanted FROM (
        SELECT id, challenges_received, full_name as name, avatar_url as avatar FROM wanted_stats
    ) t;

    WITH jumps AS (
        SELECT lrh.player_profile_id, lrh.old_rank, lrh.new_rank, (lrh.old_rank - lrh.new_rank) as jump_size, lrh.created_at,
               ROW_NUMBER() OVER(PARTITION BY lrh.player_profile_id ORDER BY (lrh.old_rank - lrh.new_rank) DESC) as rn
        FROM ladder_rank_history lrh
        WHERE lrh.old_rank > lrh.new_rank
          AND lrh.sport_id = p_sport_id
    )
    SELECT json_agg(row_to_json(t)) INTO v_hall_of_fame_skyrocketing FROM (
        SELECT j.player_profile_id as id, j.jump_size, j.old_rank, j.new_rank, j.created_at,
               pp.full_name as name, pp.avatar_url as avatar
        FROM jumps j
        JOIN player_profiles_view pp ON pp.id = j.player_profile_id
        WHERE j.rn = 1
        ORDER BY jump_size DESC
        LIMIT 5
    ) t;

    WITH pairs AS (
        SELECT 
            LEAST(player1_id, player2_id) as p1, 
            GREATEST(player1_id, player2_id) as p2,
            COUNT(*) as matches
        FROM matches
        WHERE sport_id = p_sport_id AND status IN ('PROCESSED', 'CONFIRMED')
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 5
    )
    SELECT json_agg(row_to_json(r)) INTO v_rivalries FROM (
        SELECT p.*,
            (SELECT full_name FROM player_profiles_view WHERE id = p.p1) as p1_name,
            (SELECT full_name FROM player_profiles_view WHERE id = p.p2) as p2_name,
            (SELECT avatar_url FROM player_profiles_view WHERE id = p.p1) as p1_avatar,
            (SELECT avatar_url FROM player_profiles_view WHERE id = p.p2) as p2_avatar,
            
            (SELECT COUNT(*) FROM matches WHERE sport_id = p_sport_id AND status IN ('PROCESSED', 'CONFIRMED') AND 
                ((player1_id = p.p1 AND player2_id = p.p2 AND winner_id = p.p1) OR (player1_id = p.p2 AND player2_id = p.p1 AND winner_id = p.p1))
            ) as p1_wins
        FROM pairs p
    ) r;

    RETURN json_build_object(
        'overview', json_build_object(
            'total_matches', v_total_matches,
            'total_players', v_total_players,
            'active_players', v_active_players,
            'challenger_wins', v_challenger_wins,
            'defender_wins', v_defender_wins,
            'matches_per_week', v_league_pulse,
            'rating_distribution', v_rating_distribution
        ),
        'leaderboards', json_build_object(
            'workhorse', v_hall_of_fame_workhorse,
            'flawless', v_hall_of_fame_flawless,
            'fortress', v_hall_of_fame_fortress,
            'skyrocketing', v_hall_of_fame_skyrocketing,
            'aggressor', v_hall_of_fame_aggressor,
            'wanted', v_hall_of_fame_wanted,
            'win_streaks', v_win_streaks,
            'upsets', v_upsets
        ),
        'rivalries', v_rivalries
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, status)
    VALUES (
        NEW.id, 
        NEW.email,
        CASE 
            WHEN NEW.email ILIKE '%@iima.ac.in' THEN 'verified'::public.verification_status
            ELSE 'pending'::public.verification_status
        END
    );
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.leave_ladder(p_sport_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_profile_id UUID;
    v_current_rank INTEGER;
    v_full_name TEXT;
BEGIN
    -- Get profile info
    SELECT id, ladder_rank, full_name INTO v_profile_id, v_current_rank, v_full_name
    FROM player_profiles_view
    WHERE sport_id = p_sport_id AND user_id = p_user_id;

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    IF v_current_rank IS NULL THEN
         -- Already not ranked, update status only
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

    -- Shift everyone below UP by 1 and Log History
    WITH shifted AS (
        UPDATE player_profiles
        SET ladder_rank = ladder_rank - 1
        WHERE sport_id = p_sport_id 
          AND ladder_rank > v_current_rank
          AND deactivated = FALSE
        RETURNING id, ladder_rank, (ladder_rank + 1) as old_rank
    )
    INSERT INTO ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
    SELECT p_sport_id, id, NULL, old_rank, ladder_rank, 'Rank Shift (Player Left Ladder: ' || COALESCE(v_full_name, 'Unknown') || ')'
    FROM shifted;

    -- Log for leaving player explicitly? 
    -- "add an entry in the ladder rank history table for all of those players as well"
    -- The leaving player goes to NULL. History table usually tracks shifts.
    -- Let's add an entry for the leaver too for completeness.
    INSERT INTO ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
    VALUES (p_sport_id, v_profile_id, NULL, v_current_rank, NULL, 'Left Ladder');

END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_initial_join_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Log initial rank if assigned
    IF NEW.ladder_rank IS NOT NULL THEN
        INSERT INTO public.ladder_rank_history (
            sport_id,
            player_profile_id,
            match_id,
            old_rank,
            new_rank,
            reason,
            created_at
        ) VALUES (
            NEW.sport_id,
            NEW.id,
            NULL, -- No match associated with joining
            NULL, -- No old rank
            NEW.ladder_rank,
            'Joined Ladder',
            NEW.created_at
        );
    END IF;

    -- Log initial rating (default is usually 1000)
    INSERT INTO public.ratings_history (
        player_profile_id,
        match_id,
        old_rating,
        new_rating,
        delta,
        reason,
        created_at
    ) VALUES (
        NEW.id,
        NULL, -- No match associated
        NULL, -- No old rating
        NEW.rating,
        0,    -- No delta
        'Initial Rating',
        NEW.created_at
    );

    RETURN NEW;
END;
$function$
;

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

create or replace view "public"."player_profiles_view" as  SELECT pp.id,
    pp.user_id,
    pp.sport_id,
    pp.rating,
    pp.matches_played,
    pp.ladder_rank,
    pp.is_admin,
    pp.created_at,
    pp.deactivated,
    pp.deactivated_at,
    pp.last_active_rank,
    pp.contact_number,
    au.email AS user_email,
    au.raw_user_meta_data AS user_metadata,
    COALESCE((au.raw_user_meta_data ->> 'full_name'::text), (au.raw_user_meta_data ->> 'name'::text), (au.email)::text) AS full_name,
    (au.raw_user_meta_data ->> 'avatar_url'::text) AS avatar_url
   FROM (public.player_profiles pp
     JOIN auth.users au ON ((pp.user_id = au.id)))
  WHERE (pp.deactivated = false);


CREATE OR REPLACE FUNCTION public.process_auto_verify_matches()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  m RECORD;
  cfg jsonb;
  verify_days integer;
  cutoff timestamptz;
  processed_count integer := 0;
  processed_matches jsonb := '[]'::jsonb;
BEGIN
  FOR m IN
    SELECT *
    FROM public.matches
    WHERE status = 'PROCESSING'::match_status
      AND updated_at IS NOT NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Load sport scoring config; skip if missing
    SELECT s.scoring_config INTO cfg
    FROM public.sports s
    WHERE s.id = m.sport_id
    LIMIT 1;

    IF cfg IS NULL THEN
      CONTINUE;
    END IF;

    -- Extract auto_verify_window_days (default to 3 if missing)
    BEGIN
      verify_days := (cfg ->> 'auto_verify_window_days')::int;
    EXCEPTION WHEN others THEN
      verify_days := 3;
    END;

    IF verify_days IS NULL THEN
      verify_days := 3;
    END IF;

    -- Calculate cutoff: updated_at (time result was entered) + verify window
    cutoff := m.updated_at + (verify_days || ' days')::interval;

    IF now() >= cutoff THEN
      -- Auto-verify the match
      UPDATE public.matches
      SET status = 'CONFIRMED'::match_status,
          updated_at = now()
      WHERE id = m.id;

      processed_matches := processed_matches || jsonb_build_object(
        'match_id', m.id,
        'sport_id', m.sport_id,
        'cutoff', cutoff,
        'auto_verified', true
      );

      processed_count := processed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_count', processed_count,
    'processed_matches', processed_matches
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_expired_challenges()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  m RECORD;
  cfg jsonb;
  challenge_days integer;
  cutoff timestamptz;
  processed_count integer := 0;
  processed_matches jsonb := '[]'::jsonb;
  new_scores jsonb;
  elo_result jsonb;
BEGIN
  FOR m IN
    SELECT *
    FROM public.matches
    WHERE status IN ('CHALLENGED'::match_status, 'PENDING'::match_status)
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

      -- Step 1: Set winner and move to CONFIRMED status (for consistency)
      UPDATE public.matches
      SET winner_id = player1_id,
          scores = new_scores,
          status = 'CONFIRMED'::match_status,
          updated_at = now()
      WHERE id = m.id;

      -- Step 2: Process ladder rank changes (leapfrog logic)
      -- This updates the ladder_rank for winner/loser and inserts history
      PERFORM process_ladder_match(m.id);

      -- Step 3: Process ELO changes and mark as PROCESSED
      -- This function will:
      -- - Update player ratings
      -- - Insert ratings_history
      -- - Set status to PROCESSED
      BEGIN
        SELECT process_match_elo(m.id) INTO elo_result;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue - ladder update is more critical
        RAISE NOTICE 'ELO processing failed for match %: %', m.id, SQLERRM;
        -- Still mark as processed to avoid infinite retries
        UPDATE public.matches
        SET status = 'PROCESSED'::match_status, updated_at = now()
        WHERE id = m.id;
      END;

      processed_matches := processed_matches || jsonb_build_object(
        'match_id', m.id,
        'player1_id', m.player1_id,
        'player2_id', m.player2_id,
        'sport_id', m.sport_id,
        'cutoff', cutoff,
        'status_was', m.status,
        'elo_result', COALESCE(elo_result, '{"error": "failed"}'::jsonb)
      );

      processed_count := processed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_count', processed_count,
    'processed_matches', processed_matches
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_ladder_match(match_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  m RECORD;
  winner_id uuid;
  loser_id uuid;
  winner_rank integer;
  loser_rank integer;
  winner_name text;
  loser_name text;
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

  -- Get Current Ranks AND Names (Locking rows? Views can't be locked easily, so lock base table first)
  SELECT ladder_rank INTO winner_rank FROM public.player_profiles WHERE id = winner_id FOR UPDATE;
  SELECT ladder_rank INTO loser_rank FROM public.player_profiles WHERE id = loser_id FOR UPDATE;

  -- Fetch Names for history logging
  SELECT full_name INTO winner_name FROM public.player_profiles_view WHERE id = winner_id;
  SELECT full_name INTO loser_name FROM public.player_profiles_view WHERE id = loser_id;

  -- Fallbacks
  IF winner_name IS NULL THEN winner_name := 'Opponent'; END IF;
  IF loser_name IS NULL THEN loser_name := 'Opponent'; END IF;


  -- LEAPFROG LOGIC
  -- Only change if Winner (Lower Rank/Higher Number) beats Loser (Higher Rank/Lower Number)
  
  IF winner_rank > loser_rank THEN
    -- Defer constraint check if possible

    -- Update Ranks and Capture Changes
    WITH affected AS (
        SELECT id,
            sport_id,
            ladder_rank as old_rank,
            CASE
                -- shift down players in [v_loser_rank, v_winner_rank)
                WHEN sport_id = sport_uuid AND ladder_rank >= loser_rank AND ladder_rank < winner_rank THEN ladder_rank + 1
                -- move winner to v_loser_rank
                WHEN id = winner_id THEN loser_rank
                ELSE ladder_rank
            END AS new_rank
        FROM player_profiles
        WHERE sport_id = sport_uuid
            AND (ladder_rank >= loser_rank AND ladder_rank <= winner_rank OR id = winner_id)
    ),
    updates AS (
        UPDATE player_profiles p
        SET ladder_rank = a.new_rank
        FROM affected a
        WHERE p.id = a.id
        RETURNING p.id, p.sport_id, a.old_rank, a.new_rank
    )
    -- Insert History for ALL affected players
    INSERT INTO public.ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
    SELECT 
        u.sport_id, 
        u.id, 
        m.id, 
        u.old_rank, 
        u.new_rank,
        CASE
            WHEN u.id = winner_id THEN 'Victory (Leapfrog) vs ' || loser_name
            WHEN u.id = loser_id THEN 'Defeated (Shift) by ' || winner_name
            ELSE 'Rank Adjustment: Displaced by ' || winner_name
        END
    FROM updates u
    WHERE u.old_rank IS DISTINCT FROM u.new_rank;
      
  ELSE
    -- Higher ranked player won (or equal), do nothing to ranks
    -- Optionally record "Defended" history
    INSERT INTO public.ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
    VALUES 
      (sport_uuid, winner_id, m.id, winner_rank, winner_rank, 'Victory (Defended) vs ' || loser_name),
      (sport_uuid, loser_id, m.id, loser_rank, loser_rank, 'Defeat (No Change) vs ' || winner_name);
  END IF;

END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.recalc_ladder_history()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    m RECORD;
    v_winner_id uuid;
    v_loser_id uuid;
    v_sport_id uuid;
    v_winner_rank int;
    v_loser_rank int;
    v_winner_name text;
    v_loser_name text;
BEGIN
    -- 1. Clear History
    TRUNCATE TABLE ladder_rank_history;

    -- 2. Reset Ranks (Based on join date)
    -- Reset active players to join order. Deactivated ones stay null/deactivated.
    WITH ranked_players AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY sport_id ORDER BY created_at ASC) as initial_rank
        FROM player_profiles
        WHERE deactivated = FALSE 
    )
    UPDATE player_profiles pp
    SET ladder_rank = rp.initial_rank,
        last_active_rank = NULL
    FROM ranked_players rp
    WHERE pp.id = rp.id;

    -- 3. Replay Matches
    FOR m IN 
        SELECT * FROM matches 
        WHERE status IN ('PROCESSED', 'CONFIRMED') 
        ORDER BY created_at ASC
    LOOP
        v_winner_id := m.winner_id;
        v_sport_id := m.sport_id;
        
        -- Skip if no winner
        IF v_winner_id IS NULL THEN CONTINUE; END IF;

        IF v_winner_id = m.player1_id THEN
            v_loser_id := m.player2_id;
        ELSE
            v_loser_id := m.player1_id;
        END IF;

        -- Get current ranks
        SELECT ladder_rank, full_name INTO v_winner_rank, v_winner_name 
        FROM player_profiles_view 
        WHERE id = v_winner_id;

        SELECT ladder_rank, full_name INTO v_loser_rank, v_loser_name 
        FROM player_profiles_view 
        WHERE id = v_loser_id;
        
        -- Fallback names
        IF v_winner_name IS NULL THEN v_winner_name := 'Opponent'; END IF;
        IF v_loser_name IS NULL THEN v_loser_name := 'Opponent'; END IF;

        -- Logic Mirroring process_ladder_match
        
        IF v_winner_rank IS NOT NULL AND v_loser_rank IS NOT NULL THEN
            IF v_winner_rank > v_loser_rank THEN
                -- LEAPFROG
                
                -- Update Ranks and Capture Changes
                WITH affected AS (
                    SELECT id,
                        sport_id,
                        ladder_rank as old_rank,
                        CASE
                            -- shift down players in [v_loser_rank, v_winner_rank)
                            WHEN sport_id = v_sport_id AND ladder_rank >= v_loser_rank AND ladder_rank < v_winner_rank THEN ladder_rank + 1
                            -- move winner to v_loser_rank
                            WHEN id = v_winner_id THEN v_loser_rank
                            ELSE ladder_rank
                        END AS new_rank
                    FROM player_profiles
                    WHERE sport_id = v_sport_id
                      AND (ladder_rank >= v_loser_rank AND ladder_rank <= v_winner_rank OR id = v_winner_id)
                ),
                updates AS (
                    UPDATE player_profiles p
                    SET ladder_rank = a.new_rank
                    FROM affected a
                    WHERE p.id = a.id
                    RETURNING p.id, p.sport_id, a.old_rank, a.new_rank
                )
                -- Insert History for ALL affected players
                INSERT INTO ladder_rank_history (player_profile_id, sport_id, match_id, old_rank, new_rank, reason, created_at)
                SELECT 
                    u.id,
                    u.sport_id, 
                    m.id, 
                    u.old_rank, 
                    u.new_rank,
                    CASE
                        WHEN u.id = v_winner_id THEN 'Victory (Leapfrog) vs ' || v_loser_name
                        WHEN u.id = v_loser_id THEN 'Defeated (Shift) by ' || v_winner_name
                        ELSE 'Rank Adjustment: Displaced by ' || v_winner_name
                    END,
                    m.created_at
                FROM updates u
                WHERE u.old_rank IS DISTINCT FROM u.new_rank;

            ELSE
                -- DEFENDED / NO CHANGE
                INSERT INTO ladder_rank_history (player_profile_id, sport_id, match_id, old_rank, new_rank, reason, created_at)
                VALUES (
                    v_winner_id, m.sport_id, m.id, v_winner_rank, v_winner_rank, 'Victory (Defended) vs ' || v_loser_name, m.created_at
                );

                INSERT INTO ladder_rank_history (player_profile_id, sport_id, match_id, old_rank, new_rank, reason, created_at)
                VALUES (
                    v_loser_id, m.sport_id, m.id, v_loser_rank, v_loser_rank, 'Defeat (No Change) vs ' || v_winner_name, m.created_at
                );
            END IF;
        END IF;
    END LOOP;
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

CREATE OR REPLACE FUNCTION public.rejoin_ladder(p_sport_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_profile_id UUID;
    v_last_rank INTEGER;
    v_deactivated_at TIMESTAMPTZ;
    v_weeks_away INTEGER;
    v_target_rank INTEGER;
    v_max_rank INTEGER;
    v_full_name TEXT;
BEGIN
    SELECT pp.id, pp.last_active_rank, pp.deactivated_at, 
           COALESCE((au.raw_user_meta_data ->> 'full_name'), (au.raw_user_meta_data ->> 'name'), au.email)
    INTO v_profile_id, v_last_rank, v_deactivated_at, v_full_name
    FROM player_profiles pp
    JOIN auth.users au ON pp.user_id = au.id
    WHERE pp.sport_id = p_sport_id AND pp.user_id = p_user_id AND pp.deactivated = TRUE;

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Deactivated profile not found';
    END IF;

    IF v_last_rank IS NULL THEN
         UPDATE player_profiles SET deactivated = FALSE, deactivated_at = NULL WHERE id = v_profile_id;
         SELECT COALESCE(MAX(ladder_rank), 0) INTO v_max_rank FROM player_profiles WHERE sport_id = p_sport_id;
         v_target_rank := v_max_rank + 1;
    ELSE
         v_weeks_away := CEIL(EXTRACT(EPOCH FROM (NOW() - v_deactivated_at)) / 604800);
         IF v_weeks_away < 0 THEN v_weeks_away := 0; END IF;
         
         v_target_rank := v_last_rank + v_weeks_away;
         
         SELECT COALESCE(MAX(ladder_rank), 0) INTO v_max_rank FROM player_profiles WHERE sport_id = p_sport_id;
         
         IF v_target_rank > v_max_rank + 1 THEN
            v_target_rank := v_max_rank + 1;
         END IF;
    END IF;

    -- Shift everyone at target rank and below DOWN by 1 (to make space) and Log History
    WITH shifted AS (
        UPDATE player_profiles
        SET ladder_rank = ladder_rank + 1
        WHERE sport_id = p_sport_id
          AND ladder_rank >= v_target_rank
          AND deactivated = FALSE
        RETURNING id, ladder_rank, (ladder_rank - 1) as old_rank
    )
    INSERT INTO ladder_rank_history (sport_id, player_profile_id, match_id, old_rank, new_rank, reason)
    SELECT p_sport_id, id, NULL, old_rank, ladder_rank, 'Rank Shift (Player Rejoined: ' || COALESCE(v_full_name, 'Unknown') || ')'
    FROM shifted;

    -- Update the rejoining player
    UPDATE player_profiles
    SET 
        deactivated = FALSE,
        deactivated_at = NULL,
        last_active_rank = NULL,
        ladder_rank = v_target_rank
    WHERE id = v_profile_id;

    -- Log for rejoining player
    INSERT INTO ladder_rank_history (sport_id, player_profile_id, old_rank, new_rank, match_id, reason)
    VALUES (p_sport_id, v_profile_id, NULL, v_target_rank, NULL, 'Rejoined Ladder');

    RETURN v_target_rank;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_process_ladder()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'CONFIRMED' THEN
    PERFORM public.process_ladder_match(NEW.id);
  END IF;
  RETURN NEW;
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

grant delete on table "public"."ladder_rank_history" to "anon";

grant insert on table "public"."ladder_rank_history" to "anon";

grant references on table "public"."ladder_rank_history" to "anon";

grant select on table "public"."ladder_rank_history" to "anon";

grant trigger on table "public"."ladder_rank_history" to "anon";

grant truncate on table "public"."ladder_rank_history" to "anon";

grant update on table "public"."ladder_rank_history" to "anon";

grant delete on table "public"."ladder_rank_history" to "authenticated";

grant insert on table "public"."ladder_rank_history" to "authenticated";

grant references on table "public"."ladder_rank_history" to "authenticated";

grant select on table "public"."ladder_rank_history" to "authenticated";

grant trigger on table "public"."ladder_rank_history" to "authenticated";

grant truncate on table "public"."ladder_rank_history" to "authenticated";

grant update on table "public"."ladder_rank_history" to "authenticated";

grant delete on table "public"."ladder_rank_history" to "service_role";

grant insert on table "public"."ladder_rank_history" to "service_role";

grant references on table "public"."ladder_rank_history" to "service_role";

grant select on table "public"."ladder_rank_history" to "service_role";

grant trigger on table "public"."ladder_rank_history" to "service_role";

grant truncate on table "public"."ladder_rank_history" to "service_role";

grant update on table "public"."ladder_rank_history" to "service_role";

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

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."push_subscriptions" to "anon";

grant insert on table "public"."push_subscriptions" to "anon";

grant references on table "public"."push_subscriptions" to "anon";

grant select on table "public"."push_subscriptions" to "anon";

grant trigger on table "public"."push_subscriptions" to "anon";

grant truncate on table "public"."push_subscriptions" to "anon";

grant update on table "public"."push_subscriptions" to "anon";

grant delete on table "public"."push_subscriptions" to "authenticated";

grant insert on table "public"."push_subscriptions" to "authenticated";

grant references on table "public"."push_subscriptions" to "authenticated";

grant select on table "public"."push_subscriptions" to "authenticated";

grant trigger on table "public"."push_subscriptions" to "authenticated";

grant truncate on table "public"."push_subscriptions" to "authenticated";

grant update on table "public"."push_subscriptions" to "authenticated";

grant delete on table "public"."push_subscriptions" to "service_role";

grant insert on table "public"."push_subscriptions" to "service_role";

grant references on table "public"."push_subscriptions" to "service_role";

grant select on table "public"."push_subscriptions" to "service_role";

grant trigger on table "public"."push_subscriptions" to "service_role";

grant truncate on table "public"."push_subscriptions" to "service_role";

grant update on table "public"."push_subscriptions" to "service_role";

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



  create policy "Verified users can create player profiles"
  on "public"."player_profiles"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = player_profiles.user_id) AND (profiles.status = 'verified'::public.verification_status)))));


CREATE TRIGGER matches_after_status_trigger AFTER UPDATE OF status ON public.matches FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.trigger_process_match_elo();

CREATE TRIGGER matches_ladder_update_trigger AFTER UPDATE OF status ON public.matches FOR EACH ROW EXECUTE FUNCTION public.trigger_process_ladder();

CREATE TRIGGER reactivate_profile_on_match_trigger AFTER INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.reactivate_profile_on_match();

CREATE TRIGGER trg_match_replace_action_token AFTER UPDATE OF status ON public.matches FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.match_replace_action_token_on_status_change();

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_check_paused_before_match BEFORE INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.check_sport_paused();

CREATE TRIGGER trg_assign_ladder_rank BEFORE INSERT ON public.player_profiles FOR EACH ROW EXECUTE FUNCTION public.assign_initial_ladder_rank();

CREATE TRIGGER trg_log_initial_history AFTER INSERT ON public.player_profiles FOR EACH ROW EXECUTE FUNCTION public.log_initial_join_history();

CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_verification();


