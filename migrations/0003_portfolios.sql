-- 0003_portfolios.sql
-- Confirmed portfolio snapshots extracted from broker screenshots
-- (Streaming, KGI, etc.). Pending/unconfirmed extractions live in KV
-- with a TTL until the user confirms them.

CREATE TABLE IF NOT EXISTS portfolios (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  source       TEXT,
  total_value  REAL,
  cash         REAL,
  notes        TEXT,
  taken_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_taken
  ON portfolios(user_id, taken_at DESC);

CREATE TABLE IF NOT EXISTS holdings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id    INTEGER NOT NULL,
  symbol          TEXT NOT NULL,
  quantity        REAL,
  avg_cost        REAL,
  market_price    REAL,
  market_value    REAL,
  unrealized_pl   REAL,
  weight_pct      REAL,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio
  ON holdings(portfolio_id);
