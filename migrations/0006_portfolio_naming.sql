-- 0006_portfolio_naming.sql
--
-- Lift the "one portfolio per user" assumption: each user can now keep
-- multiple named portfolios. Exactly one is "active" — that's the one
-- pulled by /พอร์ต /วิเคราะห์พอร์ต /ปรับพอร์ต and used as context for
-- free-form chat and the daily alert.
--
-- name      : user-facing label (defaulted on save, renamable)
-- is_active : 0/1, exactly one row per user_id should be 1

ALTER TABLE portfolios ADD COLUMN name TEXT;
ALTER TABLE portfolios ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;

-- Backfill: give existing rows a default name and mark each user's
-- most recent portfolio as active.
UPDATE portfolios
   SET name = COALESCE(source, 'พอร์ต') || ' · #' || id
 WHERE name IS NULL;

UPDATE portfolios
   SET is_active = 1
 WHERE id IN (SELECT MAX(id) FROM portfolios GROUP BY user_id);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_active
  ON portfolios(user_id, is_active);
