// Finnhub.io quote adapter. Free tier: 60 req/min, US real-time, HK behind
// the paid plan in practice (the request returns 0/null for non-US symbols
// on free even though the symbol is listed).
//
// We only call Finnhub for US symbols here. HK / SET are handled by other
// adapters in src/marketdata.js.

const FINNHUB_BASE = 'https://finnhub.io/api/v1/quote';

const DEFAULTS = { timeoutMs: 4000 };

export async function fetchFinnhubQuotesForSymbols(env, symbols, opts = {}) {
  if (!env.FINNHUB_KEY) return {};
  const list = (symbols || []).filter(Boolean).slice(0, 12);
  if (!list.length) return {};

  const timeoutMs = opts.timeoutMs || DEFAULTS.timeoutMs;
  const results = await Promise.all(
    list.map((sym) => fetchOne(env, sym, timeoutMs).catch(() => null)),
  );

  const out = {};
  for (let i = 0; i < list.length; i++) {
    const r = results[i];
    if (!r) continue;
    out[list[i]] = r;
  }
  return out;
}

async function fetchOne(env, symbol, timeoutMs) {
  const url = `${FINNHUB_BASE}?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${encodeURIComponent(env.FINNHUB_KEY)}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Finnhub returns 0/null fields when the symbol isn't covered on the
    // current plan. Guard against that.
    if (!data || data.c == null || data.c === 0) return null;
    return {
      symbol_used: symbol.toUpperCase(),
      currency: null,
      market_state: null,
      regular_market_price: numOrNull(data.c),
      regular_market_change: numOrNull(data.d),
      regular_market_change_pct: numOrNull(data.dp),
      regular_market_previous_close: numOrNull(data.pc),
      fifty_two_week_high: null,
      fifty_two_week_low: null,
      short_name: null,
      source: 'finnhub',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function numOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
