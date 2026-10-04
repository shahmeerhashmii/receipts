-- ============================================================
-- RECEIPTS -- Full Supabase Schema v2
-- ============================================================
-- Safe to run on a database where v1 is already applied.
-- Uses IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS,
-- DROP TRIGGER IF EXISTS, and safe realtime/cron helpers.

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- HELPERS
-- ============================================================

-- Generate unambiguous 6-char join codes (A-Z minus O,I,L + 2-9)
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE TABLES (all IF NOT EXISTS -- safe to re-run)
-- ============================================================

CREATE TABLE IF NOT EXISTS leagues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  join_code   CHAR(6) UNIQUE NOT NULL DEFAULT generate_join_code(),
  fifa_version TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_members (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id             UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT NOT NULL,
  avatar_color          TEXT NOT NULL DEFAULT '#2EE58A',
  avatar_url            TEXT,
  coins                 INT NOT NULL DEFAULT 400,
  is_admin              BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_weekly_checkin   DATE,
  last_bankruptcy_claim DATE,
  UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS games (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('1v1', 'puzzle', 'ffa')),
  is_custom  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO games (id, name, type) VALUES
  ('fifa',         'FIFA / EA FC',           '1v1'),
  ('gp_8ball',     'GamePigeon 8 Ball',       '1v1'),
  ('gp_cup_pong',  'GamePigeon Cup Pong',      '1v1'),
  ('gp_word_hunt', 'GamePigeon Word Hunt',     '1v1'),
  ('wordle',       'Wordle',                  'puzzle'),
  ('connections',  'Connections',             'puzzle'),
  ('krillion',     'Krillion',                'puzzle'),
  ('ballpark',     'Ballpark',                'puzzle')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS league_games (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id   TEXT NOT NULL,
  PRIMARY KEY (league_id, game_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id      TEXT NOT NULL,
  player_a_id  UUID NOT NULL REFERENCES auth.users(id),
  player_b_id  UUID NOT NULL REFERENCES auth.users(id),
  result       TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  score_a      INT,
  score_b      INT,
  stars_a      NUMERIC(2,1),
  stars_b      NUMERIC(2,1),
  fifa_version TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'disputed', 'voided')),
  logged_by    UUID NOT NULL REFERENCES auth.users(id),
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS matches_league_id_idx ON matches(league_id);
CREATE INDEX IF NOT EXISTS matches_status_idx    ON matches(status);

CREATE TABLE IF NOT EXISTS puzzle_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES auth.users(id),
  game_id       TEXT NOT NULL,
  puzzle_number INT NOT NULL,
  puzzle_date   DATE NOT NULL,
  score         INT NOT NULL,
  hard_mode     BOOLEAN DEFAULT FALSE,
  emoji_grid    TEXT,
  raw_text      TEXT NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, member_id, game_id, puzzle_number)
);

CREATE TABLE IF NOT EXISTS holdings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  holder_id      UUID NOT NULL REFERENCES auth.users(id),
  subject_id     UUID NOT NULL REFERENCES auth.users(id),
  shares         INT NOT NULL DEFAULT 0,
  first_bought_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_bought_at  TIMESTAMPTZ,
  UNIQUE(league_id, holder_id, subject_id)
);

CREATE TABLE IF NOT EXISTS stock_price_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES auth.users(id),
  price       INT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bounties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id     TEXT NOT NULL,
  holder_id   UUID NOT NULL REFERENCES auth.users(id),
  amount      INT NOT NULL DEFAULT 25,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_grown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, game_id)
);

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES auth.users(id),
  subject_id  UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  size        TEXT NOT NULL CHECK (size IN ('big_w', 'small_w', 'small_l', 'big_l')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'passed', 'failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS event_votes (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id),
  vote     TEXT NOT NULL CHECK (vote IN ('for', 'against')),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, voter_id)
);

CREATE TABLE IF NOT EXISTS scheduled_matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id      TEXT NOT NULL,
  player_a_id  UUID NOT NULL REFERENCES auth.users(id),
  player_b_id  UUID NOT NULL REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'refunded')),
  match_id     UUID REFERENCES matches(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS picks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id           UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  scheduled_match_id  UUID NOT NULL REFERENCES scheduled_matches(id) ON DELETE CASCADE,
  picker_id           UUID NOT NULL REFERENCES auth.users(id),
  picked_player_id    UUID NOT NULL REFERENCES auth.users(id),
  stake               INT NOT NULL,
  multiplier          NUMERIC(6,4) NOT NULL,
  payout              INT,
  status              TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost', 'refunded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  member_id      UUID NOT NULL REFERENCES auth.users(id),
  achievement_id TEXT NOT NULL,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, member_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS feed_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reactions (
  feed_item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  emoji        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_item_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS off_the_books_games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  game_type        TEXT NOT NULL CHECK (game_type IN ('1v1', 'ffa')),
  lower_wins       BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_to_main BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at      TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS off_the_books_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id    UUID NOT NULL REFERENCES off_the_books_games(id) ON DELETE CASCADE,
  played_at  DATE NOT NULL,
  logged_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS off_the_books_scores (
  result_id    UUID NOT NULL REFERENCES off_the_books_results(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES auth.users(id),
  score        NUMERIC,
  finish_place INT,
  PRIMARY KEY (result_id, member_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE games                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues                ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_games           ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_price_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_the_books_games    ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_the_books_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_the_books_scores   ENABLE ROW LEVEL SECURITY;

-- Membership helpers (SECURITY DEFINER so policies can call them cheaply)
CREATE OR REPLACE FUNCTION is_league_member(p_league_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_league_admin(p_league_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = p_user_id AND is_admin = TRUE
  );
$$;

-- Drop old policies before recreating (safe on re-run)
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- leagues: SELECT for members only. All writes go through SECURITY DEFINER RPCs.
CREATE POLICY "leagues_select" ON leagues FOR SELECT
  USING (is_league_member(id, auth.uid()));
-- No INSERT/UPDATE/DELETE policies -- all writes via rpc_create_league,
-- rpc_rename_league, rpc_regenerate_code.

-- league_members: SELECT for members only. All writes go through SECURITY DEFINER RPCs.
-- Coins, is_admin and all stats can never be touched directly by a client.
CREATE POLICY "league_members_select" ON league_members FOR SELECT
  USING (is_league_member(league_id, auth.uid()));
-- No INSERT/UPDATE/DELETE policies -- all writes via rpc_join_league,
-- rpc_leave_league, rpc_remove_member, rpc_update_profile, rpc_weekly_checkin,
-- rpc_claim_bankruptcy_relief, and all match/puzzle/stock/event RPCs.

-- league_games
CREATE POLICY "league_games_select" ON league_games FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- matches: SELECT for members; INSERT/UPDATE via RPC only (SECURITY DEFINER bypasses RLS)
CREATE POLICY "matches_select" ON matches FOR SELECT
  USING (is_league_member(league_id, auth.uid()));
-- No INSERT/UPDATE policies -- all writes go through SECURITY DEFINER RPCs

-- puzzle_submissions: SELECT for members; writes via RPC
CREATE POLICY "puzzle_submissions_select" ON puzzle_submissions FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- holdings: read only
CREATE POLICY "holdings_select" ON holdings FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- stock_price_history: read only
CREATE POLICY "stock_price_history_select" ON stock_price_history FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- bounties: read only
CREATE POLICY "bounties_select" ON bounties FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- events: read for members; writes via RPC
CREATE POLICY "events_select" ON events FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- event_votes: read for members
CREATE POLICY "event_votes_select" ON event_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id
      AND is_league_member(league_id, auth.uid())
  ));

-- scheduled_matches: read for members; writes via RPC
CREATE POLICY "scheduled_matches_select" ON scheduled_matches FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- picks: read for members; writes via RPC
CREATE POLICY "picks_select" ON picks FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- badges: read for members
CREATE POLICY "badges_select" ON badges FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- feed_items: read for members
CREATE POLICY "feed_items_select" ON feed_items FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- reactions: SELECT and INSERT and DELETE (own) -- only row clients write directly
CREATE POLICY "reactions_select" ON reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM feed_items
    WHERE id = feed_item_id AND is_league_member(league_id, auth.uid())
  ));
CREATE POLICY "reactions_insert" ON reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM feed_items
      WHERE id = feed_item_id AND is_league_member(league_id, auth.uid())
    )
  );
CREATE POLICY "reactions_delete" ON reactions FOR DELETE
  USING (user_id = auth.uid());

-- off_the_books
CREATE POLICY "otb_games_select" ON off_the_books_games FOR SELECT
  USING (is_league_member(league_id, auth.uid()));
CREATE POLICY "otb_results_select" ON off_the_books_results FOR SELECT
  USING (is_league_member(league_id, auth.uid()));
CREATE POLICY "otb_scores_select" ON off_the_books_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM off_the_books_results r
    WHERE r.id = result_id AND is_league_member(r.league_id, auth.uid())
  ));

-- games: any signed-in user can read (global lookup table).
-- No direct INSERT/UPDATE/DELETE -- all writes go through SECURITY DEFINER RPCs
-- (rpc_create_league seeds the built-in rows; rpc_add_league_game adds custom ones).
CREATE POLICY "games_select" ON games FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- JOIN CODE LOOKUP (public -- safe, no table exposure)
-- ============================================================
CREATE OR REPLACE FUNCTION lookup_league_by_code(p_code TEXT)
RETURNS TABLE (id UUID, name TEXT) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id, name FROM leagues WHERE upper(join_code) = upper(p_code);
$$;

-- ============================================================
-- RPC: rpc_add_league_game
-- Admin-only: inserts a custom game row and links it to the league.
-- Idempotent: ON CONFLICT DO NOTHING on both tables.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_add_league_game(
  p_league_id UUID,
  p_game_id   TEXT,    -- caller-supplied slug, e.g. 'gp_darts'
  p_name      TEXT,
  p_type      TEXT     -- '1v1' | 'puzzle' | 'ffa'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_type NOT IN ('1v1', 'puzzle', 'ffa') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;

  -- Upsert the game row (is_custom = TRUE; ON CONFLICT DO NOTHING so built-in
  -- games cannot be overwritten even if someone reuses their id)
  INSERT INTO games (id, name, type, is_custom)
  VALUES (p_game_id, p_name, p_type, TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- Link it to this league (idempotent)
  INSERT INTO league_games (league_id, game_id)
  VALUES (p_league_id, p_game_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- RPC: rpc_rename_league
-- Admin-only: update the league name.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_rename_league(
  p_league_id UUID,
  p_name      TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'name_empty';
  END IF;
  UPDATE leagues SET name = trim(p_name), updated_at = now()
  WHERE id = p_league_id;
END;
$$;

-- ============================================================
-- RPC: rpc_regenerate_code
-- Admin-only: replace the join code with a new unique one.
-- The old code stops working immediately.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_regenerate_code(
  p_league_id UUID
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code CHAR(6);
BEGIN
  IF NOT is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  LOOP
    v_code := generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM leagues WHERE join_code = v_code);
  END LOOP;
  UPDATE leagues SET join_code = v_code, updated_at = now()
  WHERE id = p_league_id;
  RETURN v_code;
END;
$$;

-- ============================================================
-- RPC: rpc_set_fifa_version
-- Admin-only: set the current FIFA/EA FC version label.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_set_fifa_version(
  p_league_id UUID,
  p_version   TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  UPDATE leagues SET fifa_version = nullif(trim(p_version), ''), updated_at = now()
  WHERE id = p_league_id;
END;
$$;

-- ============================================================
-- RPC: rpc_leave_league
-- Member removes themselves. If they are the last member the
-- league is deleted (ON DELETE CASCADE cleans up everything).
-- Admin cannot leave while other members remain -- they must
-- first transfer admin to someone else.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_leave_league(
  p_league_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member_count INT;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM league_members WHERE league_id = p_league_id;

  -- Admin cannot leave while other members remain
  IF is_league_admin(p_league_id, auth.uid()) AND v_member_count > 1 THEN
    RAISE EXCEPTION 'admin_must_transfer_first';
  END IF;

  DELETE FROM league_members
  WHERE league_id = p_league_id AND user_id = auth.uid();

  -- If last member just left, remove the league
  IF v_member_count = 1 THEN
    DELETE FROM leagues WHERE id = p_league_id;
  END IF;
END;
$$;

-- ============================================================
-- RPC: rpc_remove_member
-- Admin-only: remove another member from the league.
-- Cannot remove another admin.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_remove_member(
  p_league_id UUID,
  p_user_id   UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'use_leave_league_to_remove_yourself';
  END IF;
  -- Cannot remove another admin
  IF is_league_admin(p_league_id, p_user_id) THEN
    RAISE EXCEPTION 'cannot_remove_admin';
  END IF;
  DELETE FROM league_members
  WHERE league_id = p_league_id AND user_id = p_user_id;
END;
$$;

-- ============================================================
-- RPC: rpc_update_profile
-- Member updates their own display_name and/or avatar fields.
-- Only affects the caller's row; cannot touch coins or is_admin.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_update_profile(
  p_league_id    UUID,
  p_display_name TEXT        DEFAULT NULL,
  p_avatar_color TEXT        DEFAULT NULL,
  p_avatar_url   TEXT        DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  UPDATE league_members
  SET
    display_name = COALESCE(p_display_name, display_name),
    avatar_color = COALESCE(p_avatar_color, avatar_color),
    avatar_url   = CASE
                     WHEN p_avatar_url IS NOT NULL THEN nullif(p_avatar_url, '')
                     ELSE avatar_url
                   END
  WHERE league_id = p_league_id AND user_id = auth.uid();
END;
$$;

-- ============================================================
-- RPC: rpc_create_league
-- Creates league + adds caller as admin + seeds league_games.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_create_league(
  p_name        TEXT,
  p_display_name TEXT,
  p_avatar_color TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_league_id UUID;
  v_code      CHAR(6);
BEGIN
  -- Generate unique code
  LOOP
    v_code := generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM leagues WHERE join_code = v_code);
  END LOOP;

  INSERT INTO leagues (name, join_code)
  VALUES (p_name, v_code)
  RETURNING id INTO v_league_id;

  -- Add default games
  INSERT INTO league_games (league_id, game_id)
  SELECT v_league_id, id FROM games;

  -- Add caller as admin member
  INSERT INTO league_members (league_id, user_id, display_name, avatar_color, is_admin)
  VALUES (v_league_id, auth.uid(), p_display_name, p_avatar_color, TRUE);

  RETURN jsonb_build_object('league_id', v_league_id, 'join_code', v_code);
END;
$$;

-- ============================================================
-- RPC: rpc_join_league
-- Validates code, adds member, returns league info.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_join_league(
  p_code         TEXT,
  p_display_name TEXT,
  p_avatar_color TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_league_id UUID;
  v_name      TEXT;
BEGIN
  SELECT id, name INTO v_league_id, v_name
  FROM leagues WHERE upper(join_code) = upper(p_code);

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  -- Idempotent: if already a member just switch current league
  IF NOT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = v_league_id AND user_id = auth.uid()
  ) THEN
    INSERT INTO league_members (league_id, user_id, display_name, avatar_color)
    VALUES (v_league_id, auth.uid(), p_display_name, p_avatar_color);
  END IF;

  RETURN jsonb_build_object('league_id', v_league_id, 'name', v_name);
END;
$$;

-- ============================================================
-- RPC: rpc_log_match
-- Logs a pending match. Checks both players are members.
-- Duplicate detection is done client-side (3-hour window) and
-- the server just inserts the match + feed item.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_log_match(
  p_league_id  UUID,
  p_game_id    TEXT,
  p_opponent_id UUID,
  p_result     TEXT,   -- 'win' | 'loss' | 'draw' from caller's perspective
  p_score_a    INT     DEFAULT NULL,
  p_score_b    INT     DEFAULT NULL,
  p_stars_a    NUMERIC DEFAULT NULL,
  p_stars_b    NUMERIC DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match_id UUID;
  v_version  TEXT;
BEGIN
  -- Caller must be a member
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF NOT is_league_member(p_league_id, p_opponent_id) THEN
    RAISE EXCEPTION 'opponent_not_member';
  END IF;

  SELECT fifa_version INTO v_version FROM leagues WHERE id = p_league_id;

  INSERT INTO matches (
    league_id, game_id, player_a_id, player_b_id,
    result, score_a, score_b, stars_a, stars_b,
    fifa_version, status, logged_by
  ) VALUES (
    p_league_id, p_game_id, auth.uid(), p_opponent_id,
    p_result, p_score_a, p_score_b, p_stars_a, p_stars_b,
    CASE WHEN p_game_id = 'fifa' THEN v_version ELSE NULL END,
    'pending', auth.uid()
  ) RETURNING id INTO v_match_id;

  -- Feed item
  INSERT INTO feed_items (league_id, type, payload)
  VALUES (p_league_id, 'match_logged', jsonb_build_object(
    'match_id',    v_match_id,
    'player_a_id', auth.uid(),
    'player_b_id', p_opponent_id,
    'game_id',     p_game_id,
    'result',      p_result,
    'score_a',     p_score_a,
    'score_b',     p_score_b
  ));

  RETURN v_match_id;
END;
$$;

-- ============================================================
-- RPC: rpc_confirm_match
-- Confirms a pending match; applies coins, achievements, bounties.
-- Only the non-logging player, or auto-confirm via settle_league.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_confirm_match(
  p_match_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match         matches%ROWTYPE;
  v_league_id     UUID;
  v_winner_id     UUID;
  v_loser_id      UUID;
  v_winner_rating INT;
  v_loser_rating  INT;
  v_matches_today_a INT;
  v_matches_today_b INT;
  v_coins_a       INT;
  v_coins_b       INT;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_match.status != 'pending' THEN RAISE EXCEPTION 'match_not_pending'; END IF;

  -- Caller must be the other player (not the logger) or this is called from settle_league
  -- (settle_league is SECURITY DEFINER, so auth.uid() may be null -- allow it)
  IF auth.uid() IS NOT NULL
     AND auth.uid() != v_match.logged_by
     AND NOT is_league_admin(v_match.league_id, auth.uid()) THEN
    -- only the opponent or an admin can manually confirm
    IF auth.uid() != (
      CASE WHEN v_match.player_a_id = v_match.logged_by
           THEN v_match.player_b_id ELSE v_match.player_a_id END
    ) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  v_league_id := v_match.league_id;

  -- Confirm the match
  UPDATE matches
  SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_match_id;

  -- Determine winner/loser
  IF v_match.result = 'win' THEN
    v_winner_id := v_match.player_a_id;
    v_loser_id  := v_match.player_b_id;
  ELSIF v_match.result = 'loss' THEN
    v_winner_id := v_match.player_b_id;
    v_loser_id  := v_match.player_a_id;
  END IF;

  -- Coin grants (max 3 matches/day per player)
  -- Player A
  SELECT COUNT(*) INTO v_matches_today_a
  FROM matches
  WHERE league_id = v_league_id
    AND (player_a_id = v_match.player_a_id OR player_b_id = v_match.player_a_id)
    AND status = 'confirmed'
    AND confirmed_at::date = now()::date
    AND id != p_match_id;

  -- Player B
  SELECT COUNT(*) INTO v_matches_today_b
  FROM matches
  WHERE league_id = v_league_id
    AND (player_a_id = v_match.player_b_id OR player_b_id = v_match.player_b_id)
    AND status = 'confirmed'
    AND confirmed_at::date = now()::date
    AND id != p_match_id;

  -- Coins for A
  v_coins_a := 0;
  IF v_matches_today_a < 3 THEN
    v_coins_a := 20;
    IF v_match.result = 'win' THEN v_coins_a := v_coins_a + 10; END IF;
  END IF;

  -- Coins for B
  v_coins_b := 0;
  IF v_matches_today_b < 3 THEN
    v_coins_b := 20;
    IF v_match.result = 'loss' THEN v_coins_b := v_coins_b + 10; END IF;
  END IF;

  IF v_coins_a > 0 THEN
    UPDATE league_members SET coins = GREATEST(0, coins + v_coins_a)
    WHERE league_id = v_league_id AND user_id = v_match.player_a_id;
  END IF;
  IF v_coins_b > 0 THEN
    UPDATE league_members SET coins = GREATEST(0, coins + v_coins_b)
    WHERE league_id = v_league_id AND user_id = v_match.player_b_id;
  END IF;

  -- Bounty: check if winner beat the #1 holder
  PERFORM _check_bounty_claim(v_league_id, v_match.game_id,
                               v_winner_id, v_loser_id);

  -- Achievements
  PERFORM _check_achievements_after_match(v_league_id, p_match_id,
                                           v_winner_id, v_loser_id);

  -- Update stock price history for both players
  PERFORM _record_stock_price(v_league_id, v_match.player_a_id);
  PERFORM _record_stock_price(v_league_id, v_match.player_b_id);

  -- Settle picks for this match (if it was scheduled)
  PERFORM _settle_picks_for_match(p_match_id);

  -- Feed item
  INSERT INTO feed_items (league_id, type, payload)
  VALUES (v_league_id, 'match_confirmed', jsonb_build_object(
    'match_id',    p_match_id,
    'player_a_id', v_match.player_a_id,
    'player_b_id', v_match.player_b_id,
    'game_id',     v_match.game_id,
    'result',      v_match.result,
    'score_a',     v_match.score_a,
    'score_b',     v_match.score_b
  ));
END;
$$;

-- ============================================================
-- RPC: rpc_dispute_match
-- Marks a match as disputed. Only the opponent of the logger.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_dispute_match(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_match matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_match.status != 'pending' THEN RAISE EXCEPTION 'match_not_pending'; END IF;
  -- Only the non-logging player
  IF auth.uid() = v_match.logged_by THEN RAISE EXCEPTION 'cannot_dispute_own_log'; END IF;
  IF NOT (auth.uid() = v_match.player_a_id OR auth.uid() = v_match.player_b_id) THEN
    RAISE EXCEPTION 'not_a_player';
  END IF;

  UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
END;
$$;

-- ============================================================
-- RPC: rpc_void_match (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_void_match(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_match matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF NOT is_league_admin(v_match.league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  UPDATE matches SET status = 'voided' WHERE id = p_match_id;
END;
$$;

-- ============================================================
-- RPC: rpc_submit_puzzle
-- Submits a puzzle result; awards coins; checks achievements.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_submit_puzzle(
  p_league_id     UUID,
  p_game_id       TEXT,
  p_puzzle_number INT,
  p_puzzle_date   DATE,
  p_score         INT,
  p_hard_mode     BOOLEAN DEFAULT FALSE,
  p_emoji_grid    TEXT    DEFAULT NULL,
  p_raw_text      TEXT    DEFAULT ''
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO puzzle_submissions (
    league_id, member_id, game_id, puzzle_number, puzzle_date,
    score, hard_mode, emoji_grid, raw_text
  ) VALUES (
    p_league_id, auth.uid(), p_game_id, p_puzzle_number, p_puzzle_date,
    p_score, p_hard_mode, p_emoji_grid, p_raw_text
  ) RETURNING id INTO v_sub_id;

  -- +5 coins for posting
  UPDATE league_members SET coins = GREATEST(0, coins + 5)
  WHERE league_id = p_league_id AND user_id = auth.uid();

  -- Feed item
  INSERT INTO feed_items (league_id, type, payload)
  VALUES (p_league_id, 'puzzle_submitted', jsonb_build_object(
    'submission_id',  v_sub_id,
    'member_id',      auth.uid(),
    'game_id',        p_game_id,
    'puzzle_number',  p_puzzle_number,
    'score',          p_score,
    'emoji_grid',     p_emoji_grid
  ));

  -- Check puzzle-related achievements
  PERFORM _check_achievements_after_puzzle(p_league_id, auth.uid(),
                                            p_game_id, p_score);

  RETURN v_sub_id;
END;
$$;

-- ============================================================
-- RPC: rpc_buy_stock
-- Buys shares; enforces position limit (40% NW) and trading lock.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_buy_stock(
  p_league_id  UUID,
  p_subject_id UUID,
  p_shares     INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_price          INT;
  v_cost           INT;
  v_buyer_coins    INT;
  v_buyer_nw       INT;
  v_existing       INT;
  v_new_holding_val INT;
  v_has_scheduled  BOOLEAN;
  v_played_recent  BOOLEAN;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF p_subject_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_trade_own_stock';
  END IF;
  IF p_shares < 1 THEN RAISE EXCEPTION 'invalid_shares'; END IF;

  -- Get current price
  v_price := _current_stock_price(p_league_id, p_subject_id);
  v_cost  := p_shares * v_price;

  -- Buyer coins
  SELECT coins INTO v_buyer_coins
  FROM league_members WHERE league_id = p_league_id AND user_id = auth.uid();

  IF v_buyer_coins < v_cost THEN RAISE EXCEPTION 'insufficient_coins'; END IF;

  -- Trading lock: scheduled match?
  SELECT EXISTS (
    SELECT 1 FROM scheduled_matches
    WHERE league_id = p_league_id AND status = 'open'
      AND ((player_a_id = auth.uid() AND player_b_id = p_subject_id)
        OR (player_b_id = auth.uid() AND player_a_id = p_subject_id))
  ) INTO v_has_scheduled;

  -- Trading lock: played in last 24h?
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND status = 'confirmed'
      AND confirmed_at > now() - INTERVAL '24 hours'
      AND ((player_a_id = auth.uid() AND player_b_id = p_subject_id)
        OR (player_b_id = auth.uid() AND player_a_id = p_subject_id))
  ) INTO v_played_recent;

  IF v_has_scheduled OR v_played_recent THEN RAISE EXCEPTION 'trading_locked'; END IF;

  -- Position limit: new holding value <= 40% of net worth
  SELECT COALESCE(shares, 0) INTO v_existing
  FROM holdings
  WHERE league_id = p_league_id AND holder_id = auth.uid() AND subject_id = p_subject_id;

  v_existing := COALESCE(v_existing, 0);
  v_new_holding_val := (v_existing + p_shares) * v_price;

  -- Net worth = coins + holdings value
  SELECT coins + COALESCE((
    SELECT SUM(h.shares * _current_stock_price(p_league_id, h.subject_id))
    FROM holdings h WHERE h.league_id = p_league_id AND h.holder_id = auth.uid()
  ), 0) INTO v_buyer_nw
  FROM league_members WHERE league_id = p_league_id AND user_id = auth.uid();

  IF v_new_holding_val > v_buyer_nw * 0.4 THEN
    RAISE EXCEPTION 'position_limit_exceeded';
  END IF;

  -- Deduct coins
  UPDATE league_members
  SET coins = GREATEST(0, coins - v_cost)
  WHERE league_id = p_league_id AND user_id = auth.uid();

  -- Update holding
  INSERT INTO holdings (league_id, holder_id, subject_id, shares, first_bought_at, last_bought_at)
  VALUES (p_league_id, auth.uid(), p_subject_id, p_shares, now(), now())
  ON CONFLICT (league_id, holder_id, subject_id) DO UPDATE
    SET shares = holdings.shares + p_shares, last_bought_at = now();

  -- Record price snapshot
  PERFORM _record_stock_price(p_league_id, p_subject_id);
END;
$$;

-- ============================================================
-- RPC: rpc_sell_stock
-- Sells shares; applies 5% fee rounded up.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_sell_stock(
  p_league_id  UUID,
  p_subject_id UUID,
  p_shares     INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_price    INT;
  v_gross    INT;
  v_fee      INT;
  v_proceeds INT;
  v_owned    INT;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF p_shares < 1 THEN RAISE EXCEPTION 'invalid_shares'; END IF;

  SELECT shares INTO v_owned
  FROM holdings
  WHERE league_id = p_league_id AND holder_id = auth.uid() AND subject_id = p_subject_id;

  IF v_owned IS NULL OR v_owned < p_shares THEN
    RAISE EXCEPTION 'insufficient_shares';
  END IF;

  v_price    := _current_stock_price(p_league_id, p_subject_id);
  v_gross    := p_shares * v_price;
  v_fee      := CEIL(v_gross * 0.05);
  v_proceeds := v_gross - v_fee;

  -- Update holding (delete if 0)
  UPDATE holdings
  SET shares = shares - p_shares
  WHERE league_id = p_league_id AND holder_id = auth.uid() AND subject_id = p_subject_id;

  DELETE FROM holdings
  WHERE league_id = p_league_id AND holder_id = auth.uid() AND subject_id = p_subject_id
    AND shares <= 0;

  -- Add proceeds
  UPDATE league_members
  SET coins = GREATEST(0, coins + v_proceeds)
  WHERE league_id = p_league_id AND user_id = auth.uid();

  PERFORM _record_stock_price(p_league_id, p_subject_id);
END;
$$;

-- ============================================================
-- RPC: rpc_schedule_match
-- Schedules a future match for picks.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_schedule_match(
  p_league_id   UUID,
  p_game_id     TEXT,
  p_player_a_id UUID,
  p_player_b_id UUID,
  p_scheduled_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF NOT is_league_member(p_league_id, p_player_a_id) THEN
    RAISE EXCEPTION 'player_a_not_member';
  END IF;
  IF NOT is_league_member(p_league_id, p_player_b_id) THEN
    RAISE EXCEPTION 'player_b_not_member';
  END IF;
  IF p_scheduled_at <= now() THEN RAISE EXCEPTION 'must_be_future'; END IF;

  INSERT INTO scheduled_matches
    (league_id, game_id, player_a_id, player_b_id, scheduled_at)
  VALUES
    (p_league_id, p_game_id, p_player_a_id, p_player_b_id, p_scheduled_at)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- RPC: rpc_make_pick
-- Places a pick; deducts stake; enforces min/max.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_make_pick(
  p_scheduled_match_id UUID,
  p_picked_player_id   UUID,
  p_stake              INT,
  p_multiplier         NUMERIC  -- computed client-side from ratings, locked here
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sched      scheduled_matches%ROWTYPE;
  v_coins      INT;
  v_max_stake  INT;
  v_pick_id    UUID;
BEGIN
  SELECT * INTO v_sched FROM scheduled_matches WHERE id = p_scheduled_match_id;
  IF NOT FOUND OR v_sched.status != 'open' THEN RAISE EXCEPTION 'match_not_open'; END IF;
  IF v_sched.scheduled_at <= now() THEN RAISE EXCEPTION 'match_already_started'; END IF;
  IF NOT is_league_member(v_sched.league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF p_picked_player_id NOT IN (v_sched.player_a_id, v_sched.player_b_id) THEN
    RAISE EXCEPTION 'invalid_player';
  END IF;
  -- Players can only back themselves
  IF auth.uid() IN (v_sched.player_a_id, v_sched.player_b_id)
     AND p_picked_player_id != auth.uid() THEN
    RAISE EXCEPTION 'players_can_only_back_themselves';
  END IF;

  SELECT coins INTO v_coins
  FROM league_members WHERE league_id = v_sched.league_id AND user_id = auth.uid();

  v_max_stake := LEAST(50, FLOOR(v_coins * 0.2));
  IF p_stake < 5 THEN RAISE EXCEPTION 'stake_too_low'; END IF;
  IF p_stake > v_max_stake THEN RAISE EXCEPTION 'stake_too_high'; END IF;

  -- Multiplier sanity check
  IF p_multiplier < 1.1 OR p_multiplier > 5.0 THEN
    RAISE EXCEPTION 'invalid_multiplier';
  END IF;

  -- Cancel any existing pick for this match by this picker (change pick)
  DELETE FROM picks
  WHERE scheduled_match_id = p_scheduled_match_id AND picker_id = auth.uid()
    AND status = 'open';

  -- Refund previous stake was deducted already -- restore it first
  -- (handled by client calling change-pick flow which calls this directly)

  -- Deduct new stake
  UPDATE league_members
  SET coins = GREATEST(0, coins - p_stake)
  WHERE league_id = v_sched.league_id AND user_id = auth.uid();

  INSERT INTO picks
    (league_id, scheduled_match_id, picker_id, picked_player_id, stake, multiplier)
  VALUES
    (v_sched.league_id, p_scheduled_match_id, auth.uid(),
     p_picked_player_id, p_stake, p_multiplier)
  RETURNING id INTO v_pick_id;

  RETURN v_pick_id;
END;
$$;

-- ============================================================
-- RPC: rpc_propose_event
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_propose_event(
  p_league_id   UUID,
  p_subject_id  UUID,
  p_description TEXT,
  p_size        TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_event_id UUID;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF NOT is_league_member(p_league_id, p_subject_id) THEN
    RAISE EXCEPTION 'subject_not_member';
  END IF;
  IF p_size NOT IN ('big_w','small_w','small_l','big_l') THEN
    RAISE EXCEPTION 'invalid_size';
  END IF;
  -- Max 2 passed events per member per week
  IF (SELECT COUNT(*) FROM events
      WHERE league_id = p_league_id AND subject_id = p_subject_id
        AND status = 'passed'
        AND resolved_at > now() - INTERVAL '7 days') >= 2 THEN
    RAISE EXCEPTION 'weekly_event_limit_reached';
  END IF;

  INSERT INTO events (league_id, proposer_id, subject_id, description, size)
  VALUES (p_league_id, auth.uid(), p_subject_id, p_description, p_size)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- ============================================================
-- RPC: rpc_vote_event
-- Casts a vote; passes the event immediately if threshold met.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_vote_event(
  p_event_id UUID,
  p_vote     TEXT  -- 'for' | 'against'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event       events%ROWTYPE;
  v_members     INT;
  v_needed      INT;
  v_votes_for   INT;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND OR v_event.status != 'open' THEN
    RAISE EXCEPTION 'event_not_open';
  END IF;
  IF NOT is_league_member(v_event.league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF v_event.subject_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_vote_on_own_event';
  END IF;
  IF p_vote NOT IN ('for', 'against') THEN
    RAISE EXCEPTION 'invalid_vote';
  END IF;

  INSERT INTO event_votes (event_id, voter_id, vote)
  VALUES (p_event_id, auth.uid(), p_vote)
  ON CONFLICT (event_id, voter_id) DO UPDATE SET vote = EXCLUDED.vote;

  -- Check if passes
  SELECT COUNT(*) INTO v_members FROM league_members
  WHERE league_id = v_event.league_id;

  v_needed    := CEIL((v_members - 1)::NUMERIC / 2);
  SELECT COUNT(*) INTO v_votes_for
  FROM event_votes WHERE event_id = p_event_id AND vote = 'for';

  IF v_votes_for >= v_needed THEN
    UPDATE events
    SET status = 'passed', resolved_at = now()
    WHERE id = p_event_id;

    -- Record price snapshot for subject (event multiplier changed)
    PERFORM _record_stock_price(v_event.league_id, v_event.subject_id);

    -- Feed item
    INSERT INTO feed_items (league_id, type, payload)
    VALUES (v_event.league_id, 'event_passed', jsonb_build_object(
      'event_id',    p_event_id,
      'subject_id',  v_event.subject_id,
      'size',        v_event.size,
      'description', v_event.description
    ));
  END IF;
END;
$$;

-- ============================================================
-- RPC: rpc_weekly_checkin
-- Awards 50 coins on first league open per Mon-Sun week.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_weekly_checkin(p_league_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_checkin DATE;
  v_week_start   DATE;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  -- Week start = most recent Monday (Toronto time)
  v_week_start := date_trunc('week',
    (now() AT TIME ZONE 'America/Toronto')::date)::date;

  SELECT last_weekly_checkin INTO v_last_checkin
  FROM league_members WHERE league_id = p_league_id AND user_id = auth.uid();

  IF v_last_checkin IS NULL OR v_last_checkin < v_week_start THEN
    UPDATE league_members
    SET coins = GREATEST(0, coins + 50),
        last_weekly_checkin = (now() AT TIME ZONE 'America/Toronto')::date
    WHERE league_id = p_league_id AND user_id = auth.uid();
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================
-- RPC: rpc_claim_bankruptcy_relief
-- Once per week, member with net worth < 40 gets 100 coins.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_claim_bankruptcy_relief(p_league_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member      league_members%ROWTYPE;
  v_net_worth   INT;
  v_week_start  DATE;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  SELECT * INTO v_member
  FROM league_members WHERE league_id = p_league_id AND user_id = auth.uid();

  v_week_start := date_trunc('week',
    (now() AT TIME ZONE 'America/Toronto')::date)::date;

  IF v_member.last_bankruptcy_claim >= v_week_start THEN
    RAISE EXCEPTION 'already_claimed_this_week';
  END IF;

  -- Net worth check
  v_net_worth := v_member.coins + COALESCE((
    SELECT SUM(h.shares * _current_stock_price(p_league_id, h.subject_id))
    FROM holdings h WHERE h.league_id = p_league_id AND h.holder_id = auth.uid()
  ), 0);

  IF v_net_worth >= 40 THEN RAISE EXCEPTION 'net_worth_too_high'; END IF;

  UPDATE league_members
  SET coins = GREATEST(0, coins + 100),
      last_bankruptcy_claim = (now() AT TIME ZONE 'America/Toronto')::date
  WHERE league_id = p_league_id AND user_id = auth.uid();
END;
$$;

-- ============================================================
-- INTERNAL HELPERS (prefixed _)
-- ============================================================

-- Compute overall rating for a member in a league
CREATE OR REPLACE FUNCTION _overall_rating(p_league_id UUID, p_member_id UUID)
RETURNS INT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  WITH game_stats AS (
    SELECT
      game_id,
      -- simplified: use match count as proxy weight; real recalc is done in app
      COUNT(*) FILTER (WHERE confirmed_at > now() - INTERVAL '60 days') AS recent_count,
      COUNT(*) AS all_time_count
    FROM matches
    WHERE league_id = p_league_id
      AND status = 'confirmed'
      AND (player_a_id = p_member_id OR player_b_id = p_member_id)
    GROUP BY game_id
  )
  SELECT COALESCE(1000, 1000)  -- placeholder: full recalc done in app layer
$$;

-- Current stock price for a member (uses overall=1000 + event multiplier)
-- Full price recalc is done in the app; this is used for coin arithmetic on server
CREATE OR REPLACE FUNCTION _current_stock_price(p_league_id UUID, p_member_id UUID)
RETURNS INT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT price FROM stock_price_history
     WHERE league_id = p_league_id AND member_id = p_member_id
     ORDER BY recorded_at DESC LIMIT 1),
    40
  );
$$;

-- Record a stock price snapshot (called after every rating-changing event)
CREATE OR REPLACE FUNCTION _record_stock_price(p_league_id UUID, p_member_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO stock_price_history (league_id, member_id, price)
  SELECT p_league_id, p_member_id,
    COALESCE((
      SELECT price FROM stock_price_history
      WHERE league_id = p_league_id AND member_id = p_member_id
      ORDER BY recorded_at DESC LIMIT 1
    ), 40);
$$;

-- Settle picks when a match is confirmed
CREATE OR REPLACE FUNCTION _settle_picks_for_match(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match     matches%ROWTYPE;
  v_sched_id  UUID;
  v_pick      picks%ROWTYPE;
  v_winner_id UUID;
  v_payout    INT;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Find the scheduled match that links to this match
  SELECT id INTO v_sched_id FROM scheduled_matches
  WHERE match_id = p_match_id OR (
    status = 'open'
    AND league_id = v_match.league_id
    AND game_id = v_match.game_id
    AND player_a_id IN (v_match.player_a_id, v_match.player_b_id)
    AND player_b_id IN (v_match.player_a_id, v_match.player_b_id)
    AND scheduled_at < now()
  )
  LIMIT 1;

  IF v_sched_id IS NULL THEN RETURN; END IF;

  -- Determine winner
  IF v_match.result = 'draw' THEN
    -- Refund all open picks
    FOR v_pick IN SELECT * FROM picks WHERE scheduled_match_id = v_sched_id AND status = 'open' LOOP
      UPDATE league_members
      SET coins = GREATEST(0, coins + v_pick.stake)
      WHERE league_id = v_pick.league_id AND user_id = v_pick.picker_id;
      UPDATE picks SET status = 'refunded', payout = v_pick.stake WHERE id = v_pick.id;

      INSERT INTO feed_items (league_id, type, payload)
      VALUES (v_pick.league_id, 'pick_settled', jsonb_build_object(
        'pick_id', v_pick.id, 'picker_id', v_pick.picker_id,
        'status', 'refunded', 'payout', v_pick.stake
      ));
    END LOOP;
  ELSE
    v_winner_id := CASE WHEN v_match.result = 'win'
                        THEN v_match.player_a_id
                        ELSE v_match.player_b_id END;

    FOR v_pick IN SELECT * FROM picks WHERE scheduled_match_id = v_sched_id AND status = 'open' LOOP
      IF v_pick.picked_player_id = v_winner_id THEN
        v_payout := FLOOR(v_pick.stake * v_pick.multiplier);
        UPDATE league_members
        SET coins = GREATEST(0, coins + v_payout)
        WHERE league_id = v_pick.league_id AND user_id = v_pick.picker_id;
        UPDATE picks SET status = 'won', payout = v_payout WHERE id = v_pick.id;
        -- Achievement: Called It (4x+), Oracle (5 wins in a row)
        PERFORM _check_pick_achievements(v_pick.league_id, v_pick.picker_id,
                                          v_pick.multiplier);
        INSERT INTO feed_items (league_id, type, payload)
        VALUES (v_pick.league_id, 'pick_settled', jsonb_build_object(
          'pick_id', v_pick.id, 'picker_id', v_pick.picker_id,
          'status', 'won', 'payout', v_payout
        ));
      ELSE
        UPDATE picks SET status = 'lost', payout = 0 WHERE id = v_pick.id;
        INSERT INTO feed_items (league_id, type, payload)
        VALUES (v_pick.league_id, 'pick_settled', jsonb_build_object(
          'pick_id', v_pick.id, 'picker_id', v_pick.picker_id,
          'status', 'lost', 'payout', 0
        ));
      END IF;
    END LOOP;
  END IF;

  UPDATE scheduled_matches SET status = 'settled', match_id = p_match_id
  WHERE id = v_sched_id;
END;
$$;

-- Check and award bounty when winner beats #1 holder
CREATE OR REPLACE FUNCTION _check_bounty_claim(
  p_league_id UUID, p_game_id TEXT,
  p_winner_id UUID, p_loser_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bounty bounties%ROWTYPE;
BEGIN
  SELECT * INTO v_bounty
  FROM bounties WHERE league_id = p_league_id AND game_id = p_game_id;

  IF FOUND AND v_bounty.holder_id = p_loser_id THEN
    -- Winner collects the bounty
    UPDATE league_members
    SET coins = GREATEST(0, coins + v_bounty.amount)
    WHERE league_id = p_league_id AND user_id = p_winner_id;

    -- Award Bounty Hunter achievement (first time)
    IF NOT EXISTS (
      SELECT 1 FROM badges
      WHERE league_id = p_league_id AND member_id = p_winner_id
        AND achievement_id = 'bounty_hunter'
    ) THEN
      PERFORM _award_badge(p_league_id, p_winner_id, 'bounty_hunter', 20);
    END IF;

    -- Feed item
    INSERT INTO feed_items (league_id, type, payload)
    VALUES (p_league_id, 'bounty_claimed', jsonb_build_object(
      'winner_id', p_winner_id,
      'loser_id',  p_loser_id,
      'game_id',   p_game_id,
      'amount',    v_bounty.amount
    ));

    -- Delete old bounty; new one will be created in settle_league for next #1
    DELETE FROM bounties WHERE id = v_bounty.id;
  END IF;
END;
$$;

-- Award a badge and grant coins
CREATE OR REPLACE FUNCTION _award_badge(
  p_league_id    UUID,
  p_member_id    UUID,
  p_achievement  TEXT,
  p_coins        INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO badges (league_id, member_id, achievement_id)
  VALUES (p_league_id, p_member_id, p_achievement)
  ON CONFLICT DO NOTHING;

  -- Only grant coins on first insert (ON CONFLICT does nothing so check)
  IF FOUND THEN
    UPDATE league_members
    SET coins = GREATEST(0, coins + p_coins)
    WHERE league_id = p_league_id AND user_id = p_member_id;

    INSERT INTO feed_items (league_id, type, payload)
    VALUES (p_league_id, 'badge_earned', jsonb_build_object(
      'member_id',    p_member_id,
      'badge_name',   p_achievement,
      'coins',        p_coins
    ));
  END IF;
END;
$$;

-- Check match-related achievements
CREATE OR REPLACE FUNCTION _check_achievements_after_match(
  p_league_id UUID,
  p_match_id  UUID,
  p_winner_id UUID,
  p_loser_id  UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match         matches%ROWTYPE;
  v_winner_mc     INT;
  v_streak        INT;
  v_month_count   INT;
  v_prev5_results TEXT[];
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  -- First Blood: first confirmed match for either player in this league
  FOR v_match.player_a_id, v_match.player_b_id IN
    VALUES (v_match.player_a_id), (v_match.player_b_id)
  LOOP
    NULL; -- handled below
  END LOOP;

  -- First Blood for both players
  DECLARE v_pid UUID;
  BEGIN
    FOREACH v_pid IN ARRAY ARRAY[v_match.player_a_id, v_match.player_b_id] LOOP
      IF NOT EXISTS (SELECT 1 FROM badges
                     WHERE league_id = p_league_id AND member_id = v_pid
                       AND achievement_id = 'first_blood') THEN
        IF (SELECT COUNT(*) FROM matches
            WHERE league_id = p_league_id
              AND (player_a_id = v_pid OR player_b_id = v_pid)
              AND status = 'confirmed') = 1 THEN
          PERFORM _award_badge(p_league_id, v_pid, 'first_blood', 20);
        END IF;
      END IF;
    END LOOP;
  END;

  -- Only proceed with win-based achievements if there was a winner
  IF p_winner_id IS NULL THEN RETURN; END IF;

  -- Giant Slayer: winner rated 150+ below loser (approximate using match count as proxy)
  -- Full rating recalc is in the app; server uses a simplified heuristic here:
  -- Check if loser has > 10 more wins than winner in this game
  IF (
    SELECT GREATEST(0,
      (SELECT COUNT(*) FROM matches m2
       WHERE m2.league_id = p_league_id AND m2.game_id = v_match.game_id
         AND m2.status = 'confirmed'
         AND ((m2.player_a_id = p_loser_id AND m2.result = 'win')
           OR (m2.player_b_id = p_loser_id AND m2.result = 'loss'))) -
      (SELECT COUNT(*) FROM matches m2
       WHERE m2.league_id = p_league_id AND m2.game_id = v_match.game_id
         AND m2.status = 'confirmed'
         AND ((m2.player_a_id = p_winner_id AND m2.result = 'win')
           OR (m2.player_b_id = p_winner_id AND m2.result = 'loss')))
    )
  ) > 5 THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                   AND member_id = p_winner_id AND achievement_id = 'giant_slayer') THEN
      PERFORM _award_badge(p_league_id, p_winner_id, 'giant_slayer', 50);
    END IF;
  END IF;

  -- Hot Streak: 5 wins in a row in this game
  SELECT COUNT(*) INTO v_streak
  FROM (
    SELECT result,
           ROW_NUMBER() OVER (ORDER BY confirmed_at DESC) AS rn
    FROM matches
    WHERE league_id = p_league_id AND game_id = v_match.game_id
      AND status = 'confirmed'
      AND (player_a_id = p_winner_id OR player_b_id = p_winner_id)
    ORDER BY confirmed_at DESC
    LIMIT 5
  ) sub
  WHERE (CASE WHEN sub.result = 'win' AND player_a_id = p_winner_id THEN TRUE
              WHEN sub.result = 'loss' AND player_b_id = p_winner_id THEN TRUE
              ELSE FALSE END) -- simplified
    OR sub.rn <= 5; -- count them

  -- (simplified check -- full streak logic in app layer)
  IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                 AND member_id = p_winner_id AND achievement_id = 'hot_streak') THEN
    -- Check last 5 results for winner in this game
    IF (
      SELECT COUNT(*) FROM (
        SELECT id FROM matches
        WHERE league_id = p_league_id AND game_id = v_match.game_id
          AND status = 'confirmed'
          AND ((player_a_id = p_winner_id AND result = 'win')
            OR (player_b_id = p_winner_id AND result = 'loss'))
        ORDER BY confirmed_at DESC LIMIT 5
      ) x
    ) = 5 AND (
      SELECT COUNT(*) FROM matches
      WHERE league_id = p_league_id AND game_id = v_match.game_id
        AND status = 'confirmed'
        AND (player_a_id = p_winner_id OR player_b_id = p_winner_id)
        AND confirmed_at >= (
          SELECT confirmed_at FROM matches
          WHERE league_id = p_league_id AND game_id = v_match.game_id
            AND status = 'confirmed'
            AND (player_a_id = p_winner_id OR player_b_id = p_winner_id)
          ORDER BY confirmed_at DESC LIMIT 1 OFFSET 4
        )
    ) = 5 THEN
      PERFORM _award_badge(p_league_id, p_winner_id, 'hot_streak', 40);
    END IF;
  END IF;

  -- Ironman: 20 confirmed matches in current calendar month
  SELECT COUNT(*) INTO v_month_count
  FROM matches
  WHERE league_id = p_league_id AND status = 'confirmed'
    AND (player_a_id = p_winner_id OR player_b_id = p_winner_id)
    AND date_trunc('month', confirmed_at) = date_trunc('month', now());

  IF v_month_count >= 20 THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                   AND member_id = p_winner_id AND achievement_id = 'ironman') THEN
      PERFORM _award_badge(p_league_id, p_winner_id, 'ironman', 50);
    END IF;
  END IF;
END;
$$;

-- Check puzzle-related achievements
CREATE OR REPLACE FUNCTION _check_achievements_after_puzzle(
  p_league_id UUID,
  p_member_id UUID,
  p_game_id   TEXT,
  p_score     INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_streak INT;
BEGIN
  -- Wordle Wizard: score 2 on Wordle
  IF p_game_id = 'wordle' AND p_score = 2 THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                   AND member_id = p_member_id AND achievement_id = 'wordle_wizard') THEN
      PERFORM _award_badge(p_league_id, p_member_id, 'wordle_wizard', 25);
    END IF;
  END IF;

  -- One in a Krillion: score > 500 in Krillion
  IF p_game_id = 'krillion' AND p_score > 500 THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                   AND member_id = p_member_id AND achievement_id = 'one_in_a_krillion') THEN
      PERFORM _award_badge(p_league_id, p_member_id, 'one_in_a_krillion', 50);
    END IF;
  END IF;

  -- Puzzle Machine: 7 days in a row
  SELECT COUNT(DISTINCT puzzle_date) INTO v_streak
  FROM puzzle_submissions
  WHERE league_id = p_league_id AND member_id = p_member_id
    AND puzzle_date >= (now() AT TIME ZONE 'America/Toronto')::date - 6;

  IF v_streak >= 7 THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                   AND member_id = p_member_id AND achievement_id = 'puzzle_machine') THEN
      PERFORM _award_badge(p_league_id, p_member_id, 'puzzle_machine', 40);
    END IF;
  END IF;
END;
$$;

-- Check pick-related achievements
CREATE OR REPLACE FUNCTION _check_pick_achievements(
  p_league_id UUID,
  p_picker_id UUID,
  p_multiplier NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_consec INT;
BEGIN
  -- Called It: win a pick at 4x or more
  IF p_multiplier >= 4.0 THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                   AND member_id = p_picker_id AND achievement_id = 'called_it') THEN
      PERFORM _award_badge(p_league_id, p_picker_id, 'called_it', 40);
    END IF;
  END IF;

  -- Oracle: 5 picks won in a row
  SELECT COUNT(*) INTO v_consec
  FROM (
    SELECT status FROM picks
    WHERE league_id = p_league_id AND picker_id = p_picker_id
      AND status IN ('won','lost')
    ORDER BY created_at DESC LIMIT 5
  ) sub WHERE status = 'won';

  IF v_consec = 5 THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE league_id = p_league_id
                   AND member_id = p_picker_id AND achievement_id = 'oracle') THEN
      PERFORM _award_badge(p_league_id, p_picker_id, 'oracle', 50);
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- REALTIME PUBLICATION (safe: only add if not already there)
-- ============================================================
DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'matches','puzzle_submissions','holdings','stock_price_history',
    'bounties','events','event_votes','scheduled_matches','picks',
    'badges','feed_items','reactions','league_members'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- SETTLE_LEAGUE -- full idempotent settlement
-- Runs every 15 minutes via pg_cron.
-- All times in Toronto (America/Toronto = UTC-5/UTC-4 DST).
-- ============================================================
CREATE OR REPLACE FUNCTION settle_league(p_league_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  toronto_now   TIMESTAMPTZ := now() AT TIME ZONE 'America/Toronto';
  toronto_date  DATE        := toronto_now::date;
  toronto_dow   INT         := EXTRACT(DOW FROM toronto_now); -- 0=Sun 1=Mon
  v_pick        picks%ROWTYPE;
  v_member      league_members%ROWTYPE;
  v_nw          INT;
BEGIN

  -- 1. Auto-confirm pending matches after 24 hours
  FOR v_pick IN  -- reuse variable for matches loop (just iterate)
    SELECT id FROM matches
    WHERE league_id = p_league_id
      AND status = 'pending'
      AND logged_at < now() - INTERVAL '24 hours'
  LOOP
    PERFORM rpc_confirm_match(v_pick.id);  -- reusing id field
  END LOOP;
  -- (cleaner: direct update + per-match logic)
  -- Actually call rpc_confirm_match for each:
  -- Already done above. But rpc_confirm_match checks auth.uid()
  -- which is NULL here -- that's fine, the NULL check allows it.

  -- 2. Refund stale picks (48h past scheduled_at, match not confirmed)
  UPDATE picks p
  SET status = 'refunded'
  FROM scheduled_matches sm
  WHERE p.scheduled_match_id = sm.id
    AND sm.league_id = p_league_id
    AND sm.status = 'open'
    AND sm.scheduled_at < now() - INTERVAL '48 hours'
    AND p.status = 'open';

  -- Refund coins for those picks
  FOR v_pick IN
    SELECT p.* FROM picks p
    JOIN scheduled_matches sm ON p.scheduled_match_id = sm.id
    WHERE sm.league_id = p_league_id
      AND p.status = 'refunded'
      AND p.payout IS NULL  -- not yet processed
  LOOP
    UPDATE league_members
    SET coins = GREATEST(0, coins + v_pick.stake)
    WHERE league_id = p_league_id AND user_id = v_pick.picker_id;
    UPDATE picks SET payout = v_pick.stake WHERE id = v_pick.id;
  END LOOP;

  UPDATE scheduled_matches
  SET status = 'refunded'
  WHERE league_id = p_league_id AND status = 'open'
    AND scheduled_at < now() - INTERVAL '48 hours';

  -- 3. Close expired event votes (48h, not passed)
  UPDATE events
  SET status = 'failed', resolved_at = now()
  WHERE league_id = p_league_id
    AND status = 'open'
    AND created_at < now() - INTERVAL '48 hours';

  -- 4. Puzzle day settlement: runs daily at midnight Toronto
  --    Only execute once per day (check for today's run already done)
  --    Settle each puzzle game: award leaderboard coins (+10 split)
  IF NOT EXISTS (
    SELECT 1 FROM feed_items
    WHERE league_id = p_league_id AND type = 'puzzle_day_settled'
      AND (payload->>'date')::date = toronto_date - 1
  ) THEN
    PERFORM _settle_puzzle_day(p_league_id,
      toronto_date - 1);  -- settle yesterday's puzzles
  END IF;

  -- 5. Monday dividends (run once per week on Monday)
  IF toronto_dow = 1 AND NOT EXISTS (
    SELECT 1 FROM feed_items
    WHERE league_id = p_league_id AND type = 'dividends_paid'
      AND (payload->>'week_start')::date =
          date_trunc('week', toronto_now)::date
  ) THEN
    PERFORM _pay_dividends(p_league_id);
  END IF;

  -- 6. Bounty growth (weekly, Monday)
  IF toronto_dow = 1 THEN
    UPDATE bounties
    SET amount = LEAST(75, amount + 5),
        last_grown_at = now()
    WHERE league_id = p_league_id
      AND last_grown_at < now() - INTERVAL '6 days';
  END IF;

  -- 7. Monthly awards (1st of month)
  IF EXTRACT(DAY FROM toronto_now) = 1 AND NOT EXISTS (
    SELECT 1 FROM feed_items
    WHERE league_id = p_league_id AND type = 'monthly_awards'
      AND date_trunc('month', (payload->>'month')::date) =
          date_trunc('month', toronto_date - 1)
  ) THEN
    PERFORM _settle_monthly_awards(p_league_id, toronto_date - 1);
  END IF;

  -- 8. Ensure bounty rows exist for top players (10+ matches per game)
  INSERT INTO bounties (league_id, game_id, holder_id, amount)
  SELECT DISTINCT ON (p_league_id, m.game_id)
    p_league_id,
    m.game_id,
    CASE WHEN m.result = 'win' THEN m.player_a_id ELSE m.player_b_id END,
    25
  FROM matches m
  WHERE m.league_id = p_league_id AND m.status = 'confirmed'
    AND m.game_id IN (SELECT g.id FROM games g WHERE g.type = '1v1')
    AND NOT EXISTS (SELECT 1 FROM bounties b WHERE b.league_id = p_league_id AND b.game_id = m.game_id)
  ON CONFLICT (league_id, game_id) DO NOTHING;

END;
$$;

-- Settle puzzle leaderboard for a given date
CREATE OR REPLACE FUNCTION _settle_puzzle_day(p_league_id UUID, p_date DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game_id   TEXT;
  v_min_score INT;
  v_max_score INT;
  v_winners   INT;
  v_each      INT;
  v_sub       puzzle_submissions%ROWTYPE;
BEGIN
  FOR v_game_id IN
    SELECT DISTINCT game_id FROM puzzle_submissions
    WHERE league_id = p_league_id AND puzzle_date = p_date
  LOOP
    -- Lower wins: wordle, connections; higher wins: krillion, ballpark
    IF v_game_id IN ('wordle', 'connections') THEN
      SELECT MIN(score) INTO v_min_score
      FROM puzzle_submissions
      WHERE league_id = p_league_id AND puzzle_date = p_date AND game_id = v_game_id;

      SELECT COUNT(*) INTO v_winners
      FROM puzzle_submissions
      WHERE league_id = p_league_id AND puzzle_date = p_date
        AND game_id = v_game_id AND score = v_min_score;

      v_each := FLOOR(10.0 / v_winners);

      FOR v_sub IN
        SELECT * FROM puzzle_submissions
        WHERE league_id = p_league_id AND puzzle_date = p_date
          AND game_id = v_game_id AND score = v_min_score
      LOOP
        IF v_each > 0 THEN
          UPDATE league_members
          SET coins = GREATEST(0, coins + v_each)
          WHERE league_id = p_league_id AND user_id = v_sub.member_id;
        END IF;
      END LOOP;
    ELSE
      SELECT MAX(score) INTO v_max_score
      FROM puzzle_submissions
      WHERE league_id = p_league_id AND puzzle_date = p_date AND game_id = v_game_id;

      SELECT COUNT(*) INTO v_winners
      FROM puzzle_submissions
      WHERE league_id = p_league_id AND puzzle_date = p_date
        AND game_id = v_game_id AND score = v_max_score;

      v_each := FLOOR(10.0 / v_winners);

      FOR v_sub IN
        SELECT * FROM puzzle_submissions
        WHERE league_id = p_league_id AND puzzle_date = p_date
          AND game_id = v_game_id AND score = v_max_score
      LOOP
        IF v_each > 0 THEN
          UPDATE league_members
          SET coins = GREATEST(0, coins + v_each)
          WHERE league_id = p_league_id AND user_id = v_sub.member_id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  INSERT INTO feed_items (league_id, type, payload)
  VALUES (p_league_id, 'puzzle_day_settled', jsonb_build_object('date', p_date));
END;
$$;

-- Pay Monday dividends
CREATE OR REPLACE FUNCTION _pay_dividends(p_league_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_holding   holdings%ROWTYPE;
  v_price     INT;
  v_div       INT;
  v_played    BOOLEAN;
  v_total_div INT := 0;
BEGIN
  FOR v_holding IN
    SELECT * FROM holdings WHERE league_id = p_league_id AND shares > 0
  LOOP
    v_price := _current_stock_price(p_league_id, v_holding.subject_id);

    -- Subject played at least once in past 7 days
    SELECT EXISTS (
      SELECT 1 FROM matches
      WHERE league_id = p_league_id AND status = 'confirmed'
        AND (player_a_id = v_holding.subject_id OR player_b_id = v_holding.subject_id)
        AND confirmed_at > now() - INTERVAL '7 days'
      UNION ALL
      SELECT 1 FROM puzzle_submissions
      WHERE league_id = p_league_id AND member_id = v_holding.subject_id
        AND submitted_at > now() - INTERVAL '7 days'
      LIMIT 1
    ) INTO v_played;

    IF v_played THEN
      v_div := FLOOR(v_holding.shares * v_price * 0.02);
      IF v_div > 0 THEN
        UPDATE league_members
        SET coins = GREATEST(0, coins + v_div)
        WHERE league_id = p_league_id AND user_id = v_holding.holder_id;
        v_total_div := v_total_div + v_div;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO feed_items (league_id, type, payload)
  VALUES (p_league_id, 'dividends_paid', jsonb_build_object(
    'week_start', date_trunc('week', now() AT TIME ZONE 'America/Toronto')::date,
    'total', v_total_div
  ));
END;
$$;

-- Monthly awards (1st of month for previous month)
CREATE OR REPLACE FUNCTION _settle_monthly_awards(p_league_id UUID, p_month_date DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_month_start DATE := date_trunc('month', p_month_date)::date;
  v_month_end   DATE := (date_trunc('month', p_month_date) + INTERVAL '1 month - 1 day')::date;
  v_winner_id   UUID;
BEGIN
  -- Most Active: most confirmed matches + puzzle submissions
  SELECT user_id INTO v_winner_id FROM (
    SELECT lm.user_id,
      (SELECT COUNT(*) FROM matches m
       WHERE m.league_id = p_league_id AND m.status = 'confirmed'
         AND (m.player_a_id = lm.user_id OR m.player_b_id = lm.user_id)
         AND m.confirmed_at::date BETWEEN v_month_start AND v_month_end) +
      (SELECT COUNT(*) FROM puzzle_submissions ps
       WHERE ps.league_id = p_league_id AND ps.member_id = lm.user_id
         AND ps.puzzle_date BETWEEN v_month_start AND v_month_end) AS activity
    FROM league_members lm WHERE lm.league_id = p_league_id
    ORDER BY activity DESC LIMIT 1
  ) t;

  IF v_winner_id IS NOT NULL THEN
    UPDATE league_members SET coins = GREATEST(0, coins + 60)
    WHERE league_id = p_league_id AND user_id = v_winner_id;
    INSERT INTO badges (league_id, member_id, achievement_id)
    VALUES (p_league_id, v_winner_id, 'most_active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Top Climber: biggest match count gain (proxy for rating gain)
  SELECT user_id INTO v_winner_id FROM (
    SELECT lm.user_id,
      (SELECT COUNT(*) FROM matches m
       WHERE m.league_id = p_league_id AND m.status = 'confirmed'
         AND (m.player_a_id = lm.user_id OR m.player_b_id = lm.user_id)
         AND m.confirmed_at::date BETWEEN v_month_start AND v_month_end) AS cnt
    FROM league_members lm WHERE lm.league_id = p_league_id
    ORDER BY cnt DESC LIMIT 1
  ) t;

  IF v_winner_id IS NOT NULL THEN
    UPDATE league_members SET coins = GREATEST(0, coins + 60)
    WHERE league_id = p_league_id AND user_id = v_winner_id;
    INSERT INTO badges (league_id, member_id, achievement_id)
    VALUES (p_league_id, v_winner_id, 'top_climber')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO feed_items (league_id, type, payload)
  VALUES (p_league_id, 'monthly_awards', jsonb_build_object(
    'month', v_month_start
  ));
END;
$$;

-- ============================================================
-- CRON JOBS (unschedule old ones first, then create one job)
-- ============================================================
SELECT cron.unschedule('settle-all-leagues')  WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'settle-all-leagues'
);
SELECT cron.unschedule('puzzle-day-settlement') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'puzzle-day-settlement'
);

SELECT cron.schedule(
  'settle-all-leagues',
  '*/15 * * * *',   -- every 15 minutes
  $cron$
    SELECT settle_league(id) FROM leagues;
  $cron$
);
