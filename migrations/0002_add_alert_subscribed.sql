-- 0002_add_alert_subscribed.sql
-- Adds the missing alert_subscribed flag relied on by db.js subscribeAlert /
-- unsubscribeAlert / getSubscribedUsers.

ALTER TABLE users ADD COLUMN alert_subscribed INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_alert_subscribed
  ON users(alert_subscribed)
  WHERE alert_subscribed = 1;
