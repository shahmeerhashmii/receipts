-- ============================================================
-- RECEIPTS -- Full Supabase Schema
-- ============================================================
-- Run this after creating a new Supabase project.
-- Enable extensions first: pg_cron, pgcrypto (both in dashboard).

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
  code TEXT := '';
  i INT;
  r INT;
BEGIN
  FOR i IN 1..6 LOOP
    r := floor(random() * length(chars) + 1)::INT;
    code := code || substr(chars, r, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code CHAR(6) UNIQUE NOT NULL DEFAULT generate_join_code(),
  fifa_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#2EE58A',
  avatar_url TEXT,
  coins INT NOT NULL DEFAULT 400,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_weekly_checkin DATE,
  last_bankruptcy_claim DATE,
  UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,  -- 'fifa', 'gp_8ball', etc.
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('1v1', 'puzzle', 'ffa')),
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert built-in games
INSERT INTO games (id, name, type) VALUES
  ('fifa', 'FIFA / EA FC', '1v1'),
  ('gp_8ball', 'GamePigeon 8 Ball', '1v1'),
  ('gp_cup_pong', 'GamePigeon Cup Pong', '1v1'),
  ('gp_word_hunt', 'GamePigeon Word Hunt', '1v1'),
  ('wordle', 'Wordle', 'puzzle'),
  ('connections', 'Connections', 'puzzle'),
  ('krillion', 'Krillion', 'puzzle'),
  ('ballpark', 'Ballpark', 'puzzle')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS league_games (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  PRIMARY KEY (league_id, game_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  player_a_id UUID NOT NULL,
  player_b_id UUID NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  score_a INT,
  score_b INT,
  stars_a NUMERIC(2,1),
  stars_b NUMERIC(2,1),
  fifa_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'disputed', 'voided')),
  logged_by UUID NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  FOREIGN KEY (player_a_id) REFERENCES auth.users(id),
  FOREIGN KEY (player_b_id) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS matches_league_id_idx ON matches(league_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);

CREATE TABLE IF NOT EXISTS puzzle_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  game_id TEXT NOT NULL,
  puzzle_number INT NOT NULL,
  puzzle_date DATE NOT NULL,
  score INT NOT NULL,
  hard_mode BOOLEAN DEFAULT FALSE,
  emoji_grid TEXT,
  raw_text TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, member_id, game_id, puzzle_number),
  FOREIGN KEY (member_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  holder_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  shares INT NOT NULL DEFAULT 0,
  first_bought_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_bought_at TIMESTAMPTZ,
  UNIQUE(league_id, holder_id, subject_id),
  FOREIGN KEY (holder_id) REFERENCES auth.users(id),
  FOREIGN KEY (subject_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS stock_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  price INT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  description TEXT NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('big_w', 'small_w', 'small_l', 'big_l')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'passed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  FOREIGN KEY (proposer_id) REFERENCES auth.users(id),
  FOREIGN KEY (subject_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS event_votes (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('for', 'against')),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, voter_id)
);

CREATE TABLE IF NOT EXISTS scheduled_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  player_a_id UUID NOT NULL,
  player_b_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'refunded')),
  match_id UUID REFERENCES matches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  scheduled_match_id UUID NOT NULL REFERENCES scheduled_matches(id) ON DELETE CASCADE,
  picker_id UUID NOT NULL,
  picked_player_id UUID NOT NULL,
  stake INT NOT NULL,
  multiplier NUMERIC(4,3) NOT NULL,
  payout INT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (picker_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  achievement_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, member_id, achievement_id),
  FOREIGN KEY (member_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reactions (
  feed_item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_item_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS off_the_books_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('1v1', 'ffa')),
  lower_wins BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_to_main BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS off_the_books_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES off_the_books_games(id) ON DELETE CASCADE,
  played_at DATE NOT NULL,
  logged_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS off_the_books_scores (
  result_id UUID NOT NULL REFERENCES off_the_books_results(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  score NUMERIC,
  finish_place INT,
  PRIMARY KEY (result_id, member_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_the_books_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_the_books_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_the_books_scores ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of a league?
CREATE OR REPLACE FUNCTION is_league_member(p_league_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is user admin of a league?
CREATE OR REPLACE FUNCTION is_league_admin(p_league_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = p_user_id AND is_admin = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Leagues: only members can read; join through function only
CREATE POLICY "league_select" ON leagues FOR SELECT
  USING (is_league_member(id, auth.uid()));

CREATE POLICY "league_insert" ON leagues FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "league_update" ON leagues FOR UPDATE
  USING (is_league_admin(id, auth.uid()));

-- League members: readable by fellow members
CREATE POLICY "league_members_select" ON league_members FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "league_members_insert" ON league_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "league_members_update" ON league_members FOR UPDATE
  USING (user_id = auth.uid() OR is_league_admin(league_id, auth.uid()));

CREATE POLICY "league_members_delete" ON league_members FOR DELETE
  USING (user_id = auth.uid() OR is_league_admin(league_id, auth.uid()));

-- Matches: league members only
CREATE POLICY "matches_select" ON matches FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "matches_insert" ON matches FOR INSERT
  WITH CHECK (is_league_member(league_id, auth.uid()) AND logged_by = auth.uid());

CREATE POLICY "matches_update" ON matches FOR UPDATE
  USING (is_league_member(league_id, auth.uid()));

-- Puzzle submissions
CREATE POLICY "puzzle_submissions_select" ON puzzle_submissions FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "puzzle_submissions_insert" ON puzzle_submissions FOR INSERT
  WITH CHECK (is_league_member(league_id, auth.uid()) AND member_id = auth.uid());

-- Holdings
CREATE POLICY "holdings_select" ON holdings FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- Stock price history
CREATE POLICY "stock_price_history_select" ON stock_price_history FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- Events
CREATE POLICY "events_select" ON events FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (is_league_member(league_id, auth.uid()) AND proposer_id = auth.uid());

-- Event votes
CREATE POLICY "event_votes_select" ON event_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND is_league_member(league_id, auth.uid())
  ));

CREATE POLICY "event_votes_insert" ON event_votes FOR INSERT
  WITH CHECK (voter_id = auth.uid());

-- Scheduled matches
CREATE POLICY "scheduled_matches_select" ON scheduled_matches FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "scheduled_matches_insert" ON scheduled_matches FOR INSERT
  WITH CHECK (is_league_member(league_id, auth.uid()));

-- Picks
CREATE POLICY "picks_select" ON picks FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "picks_insert" ON picks FOR INSERT
  WITH CHECK (is_league_member(league_id, auth.uid()) AND picker_id = auth.uid());

-- Badges
CREATE POLICY "badges_select" ON badges FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- Feed items
CREATE POLICY "feed_items_select" ON feed_items FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

-- Reactions
CREATE POLICY "reactions_select" ON reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM feed_items WHERE id = feed_item_id AND is_league_member(league_id, auth.uid())
  ));

CREATE POLICY "reactions_insert" ON reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON reactions FOR DELETE
  USING (user_id = auth.uid());

-- Off the books
CREATE POLICY "otb_games_select" ON off_the_books_games FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "otb_results_select" ON off_the_books_results FOR SELECT
  USING (is_league_member(league_id, auth.uid()));

CREATE POLICY "otb_scores_select" ON off_the_books_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM off_the_books_results r
    WHERE r.id = result_id AND is_league_member(r.league_id, auth.uid())
  ));

-- ============================================================
-- JOIN CODE LOOKUP (public function -- safe)
-- ============================================================
CREATE OR REPLACE FUNCTION lookup_league_by_code(p_code TEXT)
RETURNS TABLE (id UUID, name TEXT) AS $$
  SELECT id, name FROM leagues WHERE upper(join_code) = upper(p_code);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
-- Enable realtime for league-scoped tables the UI listens to
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE puzzle_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE holdings;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_price_history;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE event_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE picks;
ALTER PUBLICATION supabase_realtime ADD TABLE badges;
ALTER PUBLICATION supabase_realtime ADD TABLE feed_items;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE league_members;

-- ============================================================
-- SETTLEMENT FUNCTION
-- ============================================================
-- settle_league is idempotent and handles:
-- 1. Auto-confirm matches after 24 hours
-- 2. Refund stale picks (48h after scheduled match)
-- 3. Close expired event votes (48h)
-- 4. Weekly dividends (Monday)
-- 5. Monthly awards (1st of month)
-- 6. Bounty growth (weekly)
-- 7. Bankruptcy relief eligibility check
-- This is a stub -- full implementation would go here
CREATE OR REPLACE FUNCTION settle_league(p_league_id UUID)
RETURNS VOID AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
BEGIN
  -- 1. Auto-confirm pending matches after 24 hours
  UPDATE matches
  SET status = 'confirmed', confirmed_at = now_ts
  WHERE league_id = p_league_id
    AND status = 'pending'
    AND logged_at < now_ts - INTERVAL '24 hours';

  -- 2. Refund picks where scheduled match is 48h past and not settled
  UPDATE picks p
  SET status = 'refunded'
  FROM scheduled_matches sm
  WHERE p.scheduled_match_id = sm.id
    AND sm.league_id = p_league_id
    AND sm.status = 'open'
    AND sm.scheduled_at < now_ts - INTERVAL '48 hours'
    AND p.status = 'open';

  -- Mark stale scheduled matches as refunded
  UPDATE scheduled_matches
  SET status = 'refunded'
  WHERE league_id = p_league_id
    AND status = 'open'
    AND scheduled_at < now_ts - INTERVAL '48 hours';

  -- 3. Close expired event votes (fail if not passed in 48h)
  UPDATE events
  SET status = 'failed', resolved_at = now_ts
  WHERE league_id = p_league_id
    AND status = 'open'
    AND created_at < now_ts - INTERVAL '48 hours';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CRON: Run settle_league for all leagues every hour
-- ============================================================
-- Requires pg_cron extension enabled in dashboard
SELECT cron.schedule(
  'settle-all-leagues',
  '0 * * * *',  -- every hour
  $$
  SELECT settle_league(id) FROM leagues;
  $$
);

-- ============================================================
-- MIDNIGHT PUZZLE SETTLEMENT (Toronto = UTC-5/UTC-4)
-- ============================================================
SELECT cron.schedule(
  'puzzle-day-settlement',
  '5 5 * * *',  -- 05:05 UTC = midnight-ish Toronto
  $$
  -- Puzzle settlement runs for all leagues
  -- Full implementation in Edge Function: settle_puzzles()
  SELECT settle_league(id) FROM leagues;
  $$
);
