// FX rates against THB. Source: exchangerate.host (free, no API key).
//
// fetchAndStoreFxRates() runs from a daily GitHub Actions cron via /test-fx.
// getLatestRates() reads from D1 — every wealth aggregation hits this, not
// the upstream API, so the cache lifetime is "until the next cron fires".

const EXCHANGE_RATE_API = 'https://api.exchangerate.host/latest';

// Currencies we actively track for wealth aggregation. Add new ones here
// when new asset classes need their own currency (e.g. JPY for Japan ETFs).
export const TRACKED_CURRENCIES = ['USD', 'HKD'];

export async function fetchAndStoreFxRates(env) {
  const url = `${EXCHANGE_RATE_API}?base=THB&symbols=${TRACKED_CURRENCIES.join(',')}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`fx fetch ${res.status}`);
  }
  const data = await res.json();
  // exchangerate.host returns `{ rates: { USD: 0.028, HKD: 0.21, ... } }`
  // where each value is the amount of that currency you get for 1 THB.
  // We want the inverse: how many THB per 1 unit of that currency.
  const inverted = {};
  for (const c of TRACKED_CURRENCIES) {
    const fwd = Number(data?.rates?.[c]);
    if (!Number.isFinite(fwd) || fwd <= 0) continue;
    inverted[c] = 1 / fwd;
  }
  // THB → THB is always 1, store it explicitly so callers can treat THB
  // like any other currency without special-casing.
  inverted.THB = 1;

  const stored = [];
  for (const [currency, rate] of Object.entries(inverted)) {
    await env.DB.prepare(
      `INSERT INTO fx_rates (currency, rate_to_thb, source) VALUES (?, ?, ?)`,
    )
      .bind(currency, rate, 'exchangerate.host')
      .run();
    stored.push({ currency, rate });
  }
  return stored;
}

// Returns { THB: 1, USD: 36.12, HKD: 4.61, ... } using the most recent row
// per currency. Falls back to 1 for THB if the table is empty.
export async function getLatestRates(env) {
  const { results } = await env.DB.prepare(`
    SELECT currency, rate_to_thb
      FROM fx_rates
     WHERE id IN (
       SELECT MAX(id) FROM fx_rates GROUP BY currency
     )
  `).all();
  const out = { THB: 1 };
  for (const r of (results || [])) {
    out[r.currency] = Number(r.rate_to_thb);
  }
  return out;
}

export function convertToThb(amount, currency, rates) {
  const a = Number(amount);
  if (!Number.isFinite(a)) return null;
  const rate = rates?.[currency || 'THB'];
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return a * rate;
}
