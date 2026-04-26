-- 0005_events.sql
--
-- Append-only event log for building the user's trading journey:
-- every meaningful interaction (follow, subscribe, portfolio uploaded,
-- AI analysis given, daily alert delivered, etc.) lands here with a
-- structured payload. Used to compute longitudinal views like
-- "what changed in your portfolio since last week" or "history of
-- AI verdicts on your account".
--
-- The chat history (messages) and portfolio snapshots (portfolios)
-- live in their own tables; this table records the *events* around
-- those records so we can stitch a timeline.

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,
  payload    TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_user_created
  ON events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_type
  ON events(type);
