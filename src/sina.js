// Sina Finance HK realtime adapter. Free, no key, no auth.
// Critical request requirements:
//   - Referer: https://finance.sina.com.cn  (omit and you get a 403)
//   - Response is GB2312-encoded JS:
//     var hq_str_rt_hk00700="腾讯控股,Tencent Holdings,449.000,448.500,..." ;
//
// Field positions in the rt_hkXXXXX format (1-indexed in some docs, 0-indexed
// here):
//   0: chinese name
//   1: english name
//   2: open
//   3: prev_close
//   4: current_price
//   5: high
//   6: low
//   ...
//   17: 52w high
//   18: 52w low
//   19: date
//   20: time

const SINA_BASE = 'https://hq.sinajs.cn/list=';
const CACHE_TTL = 30;

const DEFAULTS = { timeoutMs: 4000 };

export async function fetchSinaHKQuotesForSymbols(env, symbols, opts = {}) {
  const list = (symbols || [])
    .map((s) => normaliseToHkNumeric(s))
    .filter(Boolean);
  if (!list.length) return {};

  const timeoutMs = opts.timeoutMs || DEFAULTS.timeoutMs;

  const cacheKey = `quote:hk:${list.join(',')}`;
  if (env.SESSION_KV) {
    const cached = await env.SESSION_KV.get(cacheKey).catch(() => null);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }
  }

  const lookups = list.map(({ lookup }) => `rt_hk${lookup}`);
  const url = `${SINA_BASE}${encodeURIComponent(lookups.join(','))}`;

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  let raw;
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FinBot/1.0)',
        referer: 'https://finance.sina.com.cn',
        accept: '*/*',
      },
      signal: ctl.signal,
    });
    if (!res.ok) return {};
    const buf = await res.arrayBuffer();
    raw = new TextDecoder('gb2312', { fatal: false }).decode(buf);
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }

  const out = {};
  for (const { user, lookup } of list) {
    const re = new RegExp(`var hq_str_rt_hk${lookup}\\s*=\\s*"([^"]*)"`);
    const m = raw.match(re);
    if (!m) continue;
    const fields = m[1].split(',');
    if (fields.length < 7) continue;
    const price = numOrNull(fields[4]);
    const prev = numOrNull(fields[3]);
    if (price == null || price === 0) continue;
    const change = prev != null ? price - prev : null;
    const pct = prev != null && prev !== 0 ? (change / prev) * 100 : null;
    out[user] = {
      symbol_used: `${lookup}.HK`,
      currency: 'HKD',
      market_state: null,
      regular_market_price: price,
      regular_market_change: change,
      regular_market_change_pct: pct,
      regular_market_previous_close: prev,
      fifty_two_week_high: numOrNull(fields[17]),
      fifty_two_week_low: numOrNull(fields[18]),
      short_name: fields[1] || fields[0] || null,
      source: 'sina',
    };
  }

  if (env.SESSION_KV && Object.keys(out).length) {
    await env.SESSION_KV.put(cacheKey, JSON.stringify(out), { expirationTtl: CACHE_TTL })
      .catch(() => {});
  }
  return out;
}

function normaliseToHkNumeric(symbol) {
  const s = String(symbol || '').toUpperCase().trim();
  if (!s) return null;
  // Already has a region suffix that is not HK -> not for this adapter.
  if (/\.(US|TH|BK|UK)$/.test(s)) return null;
  // Strip .HK to get the numeric part.
  const stripped = s.replace(/\.HK$/, '');
  if (!/^\d+$/.test(stripped)) return null;
  // Sina expects 5-digit zero-padded HK ticker.
  const padded = stripped.padStart(5, '0');
  return { user: symbol, lookup: padded };
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
