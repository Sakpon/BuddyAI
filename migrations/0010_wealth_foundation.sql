-- 0010_wealth_foundation.sql
-- Phase 1 of the AIWealthOS rollout: lay the foundation for a THB-normalised
-- "net worth" view across every portfolio + currency the user holds.
--
-- Two additive columns and one new table — all backward-compatible. Existing
-- holdings default to thai_equity / THB so the legacy data renders correctly
-- without a backfill.

-- Per-holding asset class so net-worth aggregation can group by:
--   thai_equity | global_etf | hk_equity | thai_fund | cash | crypto | other
ALTER TABLE holdings ADD COLUMN asset_class TEXT NOT NULL DEFAULT 'thai_equity';

-- Each portfolio reports its totals in a single currency (the broker's
-- reporting currency). Used as the FX source-of-truth when summing
-- portfolios.total_value into the user's net worth.
ALTER TABLE portfolios ADD COLUMN currency TEXT NOT NULL DEFAULT 'THB';

-- Daily FX rates against THB. We append a new row per fetch and read the
-- most recent one — keeps a tiny historical record without a separate
-- snapshot table.
CREATE TABLE IF NOT EXISTS fx_rates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  currency    TEXT NOT NULL,
  rate_to_thb REAL NOT NULL,
  fetched_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  source      TEXT
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_currency_fetched
  ON fx_rates(currency, fetched_at DESC);

-- Seed reasonable starter rates so the very first net-worth view works
-- even before the FX cron has run. The cron will overwrite these with
-- live values shortly after deploy. Values are rough Q2-2026 baselines.
INSERT INTO fx_rates (currency, rate_to_thb, source) VALUES
  ('USD', 36.00, 'seed'),
  ('HKD', 4.60,  'seed'),
  ('THB', 1.00,  'seed');
