-- 0012_dividends.sql
-- AIWealthOS Phase 3 — dividend ledger.
--
-- Append-only log of dividends the user has received (or expects to receive).
-- Per-share + quantity columns are optional convenience metadata — the
-- authoritative number is amount_thb (net received). withholding_tax_thb
-- defaults to 0 so v1's "just type the amount you got" UX works without
-- forcing tax math on the user.
--
-- portfolio_id is nullable: if the user deletes the portfolio that held the
-- symbol, the dividend record survives so reports still see it. status is
-- 'received' for v1's manual-entry flow; 'announced' / 'reinvested' values
-- are reserved for later phases.

CREATE TABLE IF NOT EXISTS dividends (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              TEXT NOT NULL,
  portfolio_id         INTEGER,
  symbol               TEXT NOT NULL,
  amount_thb           REAL NOT NULL,
  per_share            REAL,
  quantity             REAL,
  withholding_tax_thb  REAL NOT NULL DEFAULT 0,
  ex_date              INTEGER,
  pay_date             INTEGER NOT NULL DEFAULT (unixepoch()),
  status               TEXT NOT NULL DEFAULT 'received',
  notes                TEXT,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dividends_user_pay
  ON dividends(user_id, pay_date DESC);

CREATE INDEX IF NOT EXISTS idx_dividends_symbol
  ON dividends(user_id, symbol);
