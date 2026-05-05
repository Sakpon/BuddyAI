-- 0009_transactions.sql
-- Append-only ledger of buy/sell transactions executed by the user
-- against a specific portfolio. The current position (qty + avg_cost)
-- still lives in `holdings` and is updated as transactions are recorded:
--   BUY  -> insert tx, weighted-avg the cost into holdings
--   SELL -> insert tx with realized_pl, decrement (or remove) holding
--
-- Free-form notes + executed_at let users back-date or annotate trades.

CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  portfolio_id  INTEGER NOT NULL,
  symbol        TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity      REAL NOT NULL,
  price         REAL NOT NULL,
  fees          REAL DEFAULT 0,
  realized_pl   REAL,
  notes         TEXT,
  executed_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_executed
  ON transactions(user_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_executed
  ON transactions(portfolio_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_symbol
  ON transactions(portfolio_id, symbol);
