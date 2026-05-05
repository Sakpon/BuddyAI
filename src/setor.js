// set.or.th unofficial JSON adapter. The SET website itself uses these
// endpoints, so they're stable enough for personal-bot use, but unofficial.
// Cache aggressively in KV (60s) to be a polite citizen.

const SET_BASE = 'https://www.set.or.th/api/set/stock';
const CACHE_TTL = 60;

const DEFAULTS = { timeoutMs: 5000 };

export async function fetchSetQuotesForSymbols(env, symbols, opts = {}) {
  const list = (symbols || []).filter(Boolean).slice(0, 12);
  if (!list.length) return {};
  const timeoutMs = opts.timeoutMs || DEFAULTS.timeoutMs;

  const results = await Promise.all(
    list.map((sym) => fetchOne(env, sym, timeoutMs).catch(() => null)),
  );
  const out = {};
  for (let i = 0; i < list.length; i++) {
    if (results[i]) out[list[i]] = results[i];
  }
  return out;
}

async function fetchOne(env, userSymbol, timeoutMs) {
  const setSym = normaliseSetSymbol(userSymbol);
  if (!setSym) return null;

  const cacheKey = `quote:set:${setSym}`;
  if (env.SESSION_KV) {
    const cached = await env.SESSION_KV.get(cacheKey).catch(() => null);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }
  }

  const url = `${SET_BASE}/${encodeURIComponent(setSym)}/highlight-data?lang=en`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FinBot/1.0)',
        accept: 'application/json',
        referer: 'https://www.set.or.th/',
      },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const last = pickNumber(data, ['last', 'lastPrice', 'last_price']);
    if (last == null) return null;
    const prev = pickNumber(data, ['prior', 'priorClose', 'prior_close', 'previousClose']);
    const change = pickNumber(data, ['change', 'priceChange']);
    let pct = pickNumber(data, ['percentChange', 'priceChangePercent', 'changePercent']);
    if (pct == null && change != null && prev != null && prev !== 0) {
      pct = (change / prev) * 100;
    }
    const out = {
      symbol_used: setSym,
      currency: 'THB',
      market_state: null,
      regular_market_price: last,
      regular_market_change: change,
      regular_market_change_pct: pct,
      regular_market_previous_close: prev,
      fifty_two_week_high: pickNumber(data, ['high52Weeks', 'high52', 'fiftyTwoWeekHigh']),
      fifty_two_week_low: pickNumber(data, ['low52Weeks', 'low52', 'fiftyTwoWeekLow']),
      short_name: data?.symbol || setSym,
      source: 'set',
    };
    if (env.SESSION_KV) {
      await env.SESSION_KV.put(cacheKey, JSON.stringify(out), { expirationTtl: CACHE_TTL })
        .catch(() => {});
    }
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function normaliseSetSymbol(symbol) {
  const s = String(symbol || '').toUpperCase().trim();
  if (!s) return null;
  // Strip Yahoo's .BK / Stooq's .TH suffix if present.
  return s.replace(/\.(BK|TH)$/, '');
}

function pickNumber(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    if (obj[k] != null) {
      const n = Number(obj[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
