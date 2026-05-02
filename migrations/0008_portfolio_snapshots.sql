-- 0008_portfolio_snapshots.sql
-- Append-only history table for portfolios. Each row captures a
-- prior state (totals + holdings JSON) of a portfolio just before
-- it was overwritten by a new upload via the "อัพเดต" flow.
--
-- The current state of a portfolio still lives in `portfolios`/`holdings`,
-- so existing analyse/rebalance/news queries keep working unchanged.

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id  INTEGER NOT NULL,
  total_value   REAL,
  cash          REAL,
  notes         TEXT,
  holdings_json TEXT,
  taken_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_portfolio_taken
  ON portfolio_snapshots(portfolio_id, taken_at DESC);
