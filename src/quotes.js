// Yahoo Finance quote fetcher. Returns latest price + day change + 52w
// range for a list of symbols. Same symbol-variant logic as src/news.js
// (try as-is, then .BK for SET, then .HK for HK numerics with leading-zero
// fallback). Failures degrade silently to {}.

const YF_QUOTE = 'https://query1.finance.yahoo.com/v7/finance/quote';

const DEFAULTS = {
  timeoutMs: 4000,
};

export async function fetchYahooQuotesForHoldings(holdings, opts = {}) {
  if (!holdings || !holdings.length) return {};
  const userSymbols = holdings.map((h) => h.symbol).filter(Boolean).slice(0, 12);

  // Build a flat list of variants and remember which user symbol each maps back to.
  const candidates = [];
  for (const s of userSymbols) {
    for (const v of symbolVariants(s)) candidates.push({ user: s, lookup: v });
  }
  if (!candidates.length) return {};

  const timeoutMs = opts.timeoutMs || DEFAULTS.timeoutMs;
  // Single batched call — Yahoo accepts comma-separated symbols.
  const allLookups = [...new Set(candidates.map((c) => c.lookup))];
  const url = `${YF_QUOTE}?symbols=${encodeURIComponent(allLookups.join(','))}`;

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  let raw;
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FinBot/1.0)',
        accept: 'application/json',
      },
      signal: ctl.signal,
    });
    if (!res.ok) return {};
    raw = await res.json();
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }

  const results = raw?.quoteResponse?.result || [];
  // Index by lookup symbol so we can map each user symbol to the first hit.
  const byLookup = {};
  for (const r of results) {
    if (!r || !r.symbol) continue;
    byLookup[String(r.symbol).toUpperCase()] = r;
  }

  const out = {};
  for (const userSym of userSymbols) {
    for (const v of symbolVariants(userSym)) {
      const r = byLookup[v.toUpperCase()];
      if (!r) continue;
      out[userSym] = {
        symbol_used: r.symbol,
        currency: r.currency || null,
        market_state: r.marketState || null,
        regular_market_price: numOrNull(r.regularMarketPrice),
        regular_market_change: numOrNull(r.regularMarketChange),
        regular_market_change_pct: numOrNull(r.regularMarketChangePercent),
        regular_market_previous_close: numOrNull(r.regularMarketPreviousClose),
        fifty_two_week_high: numOrNull(r.fiftyTwoWeekHigh),
        fifty_two_week_low: numOrNull(r.fiftyTwoWeekLow),
        short_name: r.shortName || r.longName || null,
      };
      break;
    }
  }
  return out;
}

function symbolVariants(symbol) {
  const s = String(symbol || '').toUpperCase().trim();
  if (!s) return [];
  if (s.includes('.')) return [s];

  const out = [s];
  out.push(`${s}.BK`);
  if (/^\d{4,5}$/.test(s)) {
    out.push(`${s}.HK`);
    if (s.startsWith('0')) out.push(`${s.replace(/^0+/, '')}.HK`);
  }
  return out;
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
