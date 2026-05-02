// Light wrapper over Yahoo Finance's unofficial JSON search endpoint.
// Returns recent news articles for a single symbol (or [] on any failure —
// the caller falls back gracefully to a Claude-only thematic prompt).

const YF_BASE = 'https://query1.finance.yahoo.com/v1/finance/search';

const DEFAULTS = {
  count: 3,
  timeoutMs: 4000,
};

export async function fetchYahooNewsForSymbol(symbol, opts = {}) {
  const count = opts.count || DEFAULTS.count;
  const timeoutMs = opts.timeoutMs || DEFAULTS.timeoutMs;
  const variants = symbolVariants(symbol);

  for (const v of variants) {
    const items = await tryFetch(v, count, timeoutMs);
    if (items.length) return items;
  }
  return [];
}

export async function fetchYahooNewsForHoldings(holdings, opts = {}) {
  if (!holdings || !holdings.length) return {};
  // Cap fan-out: fetch news for at most 8 symbols to stay well under
  // the worker's request budget.
  const top = holdings.slice(0, 8).map((h) => h.symbol).filter(Boolean);
  const out = {};
  await Promise.all(
    top.map(async (sym) => {
      try {
        const news = await fetchYahooNewsForSymbol(sym, opts);
        if (news.length) out[sym] = news;
      } catch (err) {
        console.error('yahoo news fail', sym, err?.message || err);
      }
    }),
  );
  return out;
}

async function tryFetch(symbol, count, timeoutMs) {
  const url = `${YF_BASE}?q=${encodeURIComponent(symbol)}&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FinBot/1.0)',
        accept: 'application/json',
      },
      signal: ctl.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.news || []).slice(0, count).map((n) => ({
      title: String(n.title || '').slice(0, 300),
      publisher: n.publisher || null,
      link: n.link || null,
      summary: String(n.summary || n.description || '').slice(0, 400),
      published_at: n.providerPublishTime || null,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

function symbolVariants(symbol) {
  const s = String(symbol || '').toUpperCase().trim();
  if (!s) return [];
  if (s.includes('.')) return [s];

  const out = [s];
  // SET (Thai)
  out.push(`${s}.BK`);
  // HK numeric tickers (e.g. 02318 -> 02318.HK; also 2318.HK without leading zero)
  if (/^\d{4,5}$/.test(s)) {
    out.push(`${s}.HK`);
    if (s.startsWith('0')) out.push(`${s.replace(/^0+/, '')}.HK`);
  }
  return out;
}
