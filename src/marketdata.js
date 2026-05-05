// Unified quote orchestrator.
//
// Routes each user symbol to the right adapter based on inferred market,
// then falls back to Stooq if the primary returned nothing.
//
// Inference rules (no per-portfolio market column today):
//   - 4-5 digit numeric              -> HK   (primary: sina, fallback: stooq)
//   - ends in .HK                    -> HK   (same)
//   - ends in .BK or .TH             -> SET  (primary: setor, fallback: stooq)
//   - bare alpha (likely US)         -> US   (primary: finnhub, fallback: stooq)
//   - explicit .US suffix            -> US   (same)
//   - anything else                  -> US   (default; finnhub then stooq)
//
// Each adapter returns the same standardized shape used by showHoldingsStatus
// (regular_market_price, _change, _change_pct, _previous_close,
// fifty_two_week_high, fifty_two_week_low, source). Yahoo is intentionally
// not consulted here — it blocks CF Workers and we have better sources now.

import { fetchFinnhubQuotesForSymbols } from './finnhub.js';
import { fetchSetQuotesForSymbols } from './setor.js';
import { fetchSinaHKQuotesForSymbols } from './sina.js';
import { fetchStooqQuotesForHoldings } from './stooq.js';

export async function fetchUnifiedQuotesForHoldings(env, holdings) {
  const symbols = (holdings || []).map((h) => h.symbol).filter(Boolean);
  if (!symbols.length) return {};

  const grouped = { us: [], hk: [], set: [] };
  for (const s of symbols) {
    grouped[inferMarket(s)].push(s);
  }

  // Run primaries in parallel.
  const [usQuotes, hkQuotes, setQuotes] = await Promise.all([
    grouped.us.length ? fetchFinnhubQuotesForSymbols(env, grouped.us).catch(() => ({})) : {},
    grouped.hk.length ? fetchSinaHKQuotesForSymbols(env, grouped.hk).catch(() => ({})) : {},
    grouped.set.length ? fetchSetQuotesForSymbols(env, grouped.set).catch(() => ({})) : {},
  ]);

  const merged = { ...usQuotes, ...hkQuotes, ...setQuotes };

  // Stooq fallback for everyone the primaries missed.
  const missing = symbols.filter((s) => !merged[s]).map((s) => ({ symbol: s }));
  if (missing.length) {
    const stooqQuotes = await fetchStooqQuotesForHoldings(missing).catch(() => ({}));
    for (const sym of Object.keys(stooqQuotes)) {
      if (!merged[sym]) merged[sym] = stooqQuotes[sym];
    }
  }

  return merged;
}

function inferMarket(symbol) {
  const s = String(symbol || '').toUpperCase().trim();
  if (/^\d{4,5}$/.test(s)) return 'hk';
  if (s.endsWith('.HK')) return 'hk';
  if (s.endsWith('.BK') || s.endsWith('.TH')) return 'set';
  if (s.endsWith('.US')) return 'us';
  return 'us'; // default — bare alpha tickers usually mean US
}
