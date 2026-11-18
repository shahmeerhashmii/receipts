-- Adds Letter Burn and Eyeball (BabaFox daily games) to an existing Receipts database.
-- Safe to run more than once. Run it in the Supabase SQL Editor.

-- 1. The two new games
INSERT INTO games (id, name, type) VALUES
  ('letterburn', 'Letter Burn', 'puzzle'),
  ('eyeball',    'Eyeball',     'puzzle')
ON CONFLICT DO NOTHING;

-- 2. Turn them on in every existing league
INSERT INTO league_games (league_id, game_id)
SELECT l.id, g.id
FROM leagues l
CROSS JOIN (VALUES ('letterburn'), ('eyeball')) AS g(id)
ON CONFLICT DO NOTHING;

-- 3. Eyeball is lower-wins (fewest pixels off), so the daily coin settlement
--    needs the updated _settle_puzzle_day from schema.sql. Re-run that one
--    CREATE OR REPLACE FUNCTION block from schema.sql after this file.
