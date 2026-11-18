-- Receipts: matches count the moment they're logged.
-- Before: a logged match sat in 'pending' until the opponent confirmed it, so logging did nothing
-- to ratings, coins or stock prices. Now rpc_log_match confirms straight away (ratings, coins,
-- bounties, achievements and stock history all update), and the opponent gets 48 hours to dispute.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

CREATE OR REPLACE FUNCTION rpc_log_match(
  p_league_id  UUID,
  p_game_id    TEXT,
  p_opponent_id UUID,
  p_result     TEXT,
  p_score_a    INT     DEFAULT NULL,
  p_score_b    INT     DEFAULT NULL,
  p_stars_a    NUMERIC DEFAULT NULL,
  p_stars_b    NUMERIC DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match_id UUID;
  v_version  TEXT;
BEGIN
  IF NOT is_league_member(p_league_id, auth.uid()) THEN RAISE EXCEPTION 'not_member'; END IF;
  IF NOT is_league_member(p_league_id, p_opponent_id) THEN RAISE EXCEPTION 'opponent_not_member'; END IF;

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

  INSERT INTO feed_items (league_id, type, payload)
  VALUES (p_league_id, 'match_logged', jsonb_build_object(
    'match_id', v_match_id, 'player_a_id', auth.uid(), 'player_b_id', p_opponent_id,
    'game_id', p_game_id, 'result', p_result, 'score_a', p_score_a, 'score_b', p_score_b
  ));

  -- Count it now (the logger is allowed to confirm their own match)
  PERFORM rpc_confirm_match(v_match_id);

  RETURN v_match_id;
END;
$$;

-- The other player can dispute a confirmed match for 48 hours after it was logged.
CREATE OR REPLACE FUNCTION rpc_dispute_match(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_match matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF NOT (v_match.status = 'pending' OR (v_match.status = 'confirmed' AND v_match.logged_at > now() - interval '48 hours')) THEN
    RAISE EXCEPTION 'dispute_window_closed';
  END IF;
  IF auth.uid() = v_match.logged_by THEN RAISE EXCEPTION 'cannot_dispute_own_log'; END IF;
  IF NOT (auth.uid() = v_match.player_a_id OR auth.uid() = v_match.player_b_id) THEN RAISE EXCEPTION 'not_a_player'; END IF;
  UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
  INSERT INTO feed_items (league_id, type, payload)
  VALUES (v_match.league_id, 'match_disputed', jsonb_build_object('match_id', p_match_id, 'by', auth.uid()));
END;
$$;

-- Older matches still stuck in 'pending' from before this change: count them too.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM matches WHERE status = 'pending' ORDER BY logged_at LOOP
    BEGIN PERFORM rpc_confirm_match(r.id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
