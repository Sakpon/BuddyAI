-- 0007_news_subscribed.sql
-- Split the daily-alert opt-in (existing alert_subscribed) from the
-- daily-news opt-in. Backfill: any existing alert subscriber also gets
-- news on by default, so behaviour is unchanged for users who were
-- subscribed before this migration.

ALTER TABLE users ADD COLUMN news_subscribed INTEGER NOT NULL DEFAULT 0;

UPDATE users
   SET news_subscribed = 1
 WHERE alert_subscribed = 1;

CREATE INDEX IF NOT EXISTS idx_users_news_subscribed
  ON users(news_subscribed)
  WHERE news_subscribed = 1;
