-- 0011_goals.sql
-- AIWealthOS Phase 1.2 — long-term wealth goals + DCA contribution log.
--
-- One active goal per user (the deck's free-tier limit). Multi-goal support
-- belongs to the Pro tier and ships in a later migration.
--
-- Goals carry the target amount + horizon + allocation, plus the pre-computed
-- monthly contribution back-solved at creation time. We store the result so
-- the goal card doesn't have to re-solve on every read; users see the same
-- number every time even if our default-return assumption later changes.

CREATE TABLE IF NOT EXISTS goals (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                  TEXT NOT NULL,
  target_amount_thb        REAL NOT NULL,
  target_year              INTEGER NOT NULL,
  expected_return_pct      REAL NOT NULL DEFAULT 6.5,
  monthly_contribution_thb REAL NOT NULL,
  -- JSON: {"thai_equity":0.6,"global_etf":0.3,"cash":0.1}
  allocation_targets_json  TEXT NOT NULL,
  -- Default to active. Replaced atomically on re-create.
  is_active                INTEGER NOT NULL DEFAULT 1,
  created_at               INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at               INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goals_user_active
  ON goals(user_id, is_active);

-- Per-DCA contribution. asset_class makes drift analysis cheap later
-- (Phase 2 — we'll need "did the user actually DCA into the underweight class?").
-- goal_id is nullable so contributions stay attached even if the goal is
-- recreated (rare, but means the contribution history isn't orphaned).
CREATE TABLE IF NOT EXISTS contributions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  goal_id        INTEGER,
  asset_class    TEXT NOT NULL,
  amount_thb     REAL NOT NULL,
  notes          TEXT,
  contributed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contributions_user_date
  ON contributions(user_id, contributed_at DESC);

CREATE INDEX IF NOT EXISTS idx_contributions_goal
  ON contributions(goal_id);
