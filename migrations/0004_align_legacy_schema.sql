-- 0004_align_legacy_schema.sql
--
-- The D1 instance was inherited from finance-line-bot, which has a `users`
-- table with a different column layout (no `user_id`). Our 0001_init.sql
-- uses CREATE TABLE IF NOT EXISTS, so it silently skipped — and now every
-- INSERT in db.js fails with: "table users has no column named user_id".
--
-- Fix: drop and recreate `users` and `messages` to match the schema we
-- actually want. This LOSES any pre-existing rows in those two tables
-- from the old finance-line-bot install. The portfolios + holdings
-- tables added in 0003 are untouched.
--
-- Idempotency is handled by the `_migrations` tracking table in
-- deploy.yml — this file runs at most once per database.

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id          TEXT PRIMARY KEY,
  display_name     TEXT,
  picture_url      TEXT,
  language         TEXT DEFAULT 'th',
  alert_subscribed INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_user_created
  ON messages(user_id, created_at DESC);

CREATE INDEX idx_users_alert_subscribed
  ON users(alert_subscribed)
  WHERE alert_subscribed = 1;
