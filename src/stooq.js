// Stooq.com quote fallback. Free CSV API, no auth, doesn't block CF Workers.
// Returns latest OHLC + volume. We don't get 52-week high/low or true
// day-change-vs-previous-close, so day_change_pct is computed intra-day
// as ((close - open) / open) * 100 — explicitly less precise than Yahoo's
// regularMarketChangePercent, but better than nothing when Yahoo is blocked.

const STOOQ_BASE = 'https://stooq.com/q/l/';

const DEFAULTS = { timeoutMs: 5000 };

export async function fetchStooqQuotesForHoldings(holdings, opts = {}) {
  if (!holdings || !holdings.length) return {};
  const userSymbols = holdings.map((h) => h.symbol).filter(Boolean).slice(0, 12);

  // Build flat list of variants → user symbol map.
  const tries = [];
  for (const s of userSymbols) {
    for (const v of stooqVariants(s)) tries.push({ user: s, lookup: v });
  }
  if (!tries.length) return {};

  const timeoutMs = opts.timeoutMs || DEFAULTS.timeoutMs;
  const allLookups = [...new Set(tries.map((t) => t.lookup))];
  const url = `${STOOQ_BASE}?s=${encodeURIComponent(allLookups.join(','))}&f=sd2t2ohlcv&h&e=csv`;

  const ctl = new AbortController();
  const tmr = setTimeout(() => ctl.abort(), timeoutMs);
  let csv;
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FinBot/1.0)',
        accept: 'text/csv',
      },
      signal: ctl.signal,
    });
    if (!res.ok) return {};
    csv = await res.text();
  } catch {
    return {};
  } finally {
    clearTimeout(tmr);
  }

  const byLookup = parseCsv(csv);
  const out = {};
  for (const userSym of userSymbols) {
    for (const v of stooqVariants(userSym)) {
      const r = byLookup[v.toUpperCase()];
      if (!r) continue;
      out[userSym] = {
        symbol_used: r.symbol,
        currency: null,
        market_state: null,
        regular_market_price: r.close,
        regular_market_change: r.close != null && r.open != null ? r.close - r.open : null,
        regular_market_change_pct: r.close != null && r.open != null && r.open !== 0
          ? ((r.close - r.open) / r.open) * 100
          : null,
        regular_market_previous_close: null,
        fifty_two_week_high: null,
        fifty_two_week_low: null,
        short_name: null,
        source: 'stooq',
      };
      break;
    }
  }
  return out;
}

function parseCsv(csv) {
  const out = {};
  if (!csv) return out;
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return out;
  // Header indices.
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (n) => head.indexOf(n);
  const iSym = idx('symbol');
  const iOpen = idx('open');
  const iClose = idx('close');
  if (iSym < 0) return out;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cols = row.split(',').map((c) => c.trim());
    const sym = cols[iSym];
    if (!sym || sym === 'N/D') continue;
    const open = numOrNull(cols[iOpen]);
    const close = numOrNull(cols[iClose]);
    if (close == null) continue; // N/D row — symbol unknown to Stooq.
    out[sym.toUpperCase()] = { symbol: sym, open, close };
  }
  return out;
}

function stooqVariants(symbol) {
  const s = String(symbol || '').toLowerCase().trim();
  if (!s) return [];
  // If user already provided a Stooq-style suffix, use it as-is.
  if (s.endsWith('.us') || s.endsWith('.th') || s.endsWith('.hk') || s.endsWith('.uk')) {
    return [s];
  }

  const out = [];
  // Convert Yahoo .BK → Stooq .th
  if (s.endsWith('.bk')) {
    out.push(s.replace(/\.bk$/, '.th'));
    return out;
  }
  // Numeric ticker (HK) — Stooq wants no leading zeros, .hk suffix.
  if (/^\d{4,5}$/.test(s)) {
    const stripped = s.replace(/^0+/, '') || s;
    out.push(`${stripped}.hk`);
    return out;
  }
  // Plain alpha — try US first, then Thai (some users hold both).
  out.push(`${s}.us`);
  out.push(`${s}.th`);
  return out;
}

function numOrNull(v) {
  if (v == null || v === '' || v === 'N/D') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
