-- 0013_dca_overrides.sql
-- Per-month override of the goal's standing DCA. Lets a user say "฿80K in
-- June instead of my usual ฿30K" without changing the long-term plan.
--
-- year_month is a "YYYY-MM" string in Asia/Bangkok — string instead of an
-- integer epoch because the DCA cycle is calendar-month based, and the
-- nudge cron already keys throttles by bangkokYearMonth().
--
-- UNIQUE(user_id, goal_id, year_month) so the upsert (INSERT … ON CONFLICT)
-- updates an existing override for the same month instead of duplicating.

CREATE TABLE IF NOT EXISTS dca_overrides (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  goal_id       INTEGER NOT NULL,
  year_month    TEXT NOT NULL,
  amount_thb    REAL NOT NULL,
  notes         TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
  UNIQUE(user_id, goal_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_dca_overrides_user_ym
  ON dca_overrides(user_id, year_month);
