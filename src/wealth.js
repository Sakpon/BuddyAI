// Net-worth aggregation — collapses every portfolio + holding into a single
// THB number, with a per-asset-class breakdown. The FX rates come from D1
// (populated by the daily fx cron); we never call upstream FX in the hot
// path of a wealth view.

import { ASSET_CLASSES, defaultCurrencyForClass } from './assetclass.js';
import { convertToThb, getLatestRates } from './fx.js';

// Returns:
//   {
//     total_thb: number,
//     breakdown: [
//       { class, label, emoji, color, value_thb, pct, currency_mix: ['USD', 'THB', ...] },
//       ...
//     ],
//     portfolios: [
//       { id, name, currency, total_thb, total_native, holding_count },
//       ...
//     ],
//     fx: { THB: 1, USD: 36.12, HKD: 4.6, ... },
//     fx_fetched_at: number | null,
//     warnings: [string],
//   }
export async function getNetWorth(env, userId) {
  const rates = await getLatestRates(env);
  const fxFetchedAt = await env.DB.prepare(`
    SELECT MAX(fetched_at) AS ts FROM fx_rates
     WHERE source != 'seed'
  `).first().catch(() => null);

  // Pull every portfolio + their holdings in one go.
  const { results: portfolios } = await env.DB.prepare(`
    SELECT id, name, currency, total_value, cash, taken_at
      FROM portfolios
     WHERE user_id = ?
  `).bind(userId).all();

  const warnings = [];
  const portfolioRows = [];
  const classTotals = new Map(); // class → { value_thb, currencies: Set }

  for (const p of (portfolios || [])) {
    const portfolioCurrency = p.currency || 'THB';
    const portfolioTotalThb = convertToThb(p.total_value, portfolioCurrency, rates);
    if (p.total_value != null && portfolioTotalThb == null) {
      warnings.push(`พอร์ต "${p.name}" ใช้สกุลเงิน ${portfolioCurrency} แต่ระบบยังไม่มีอัตราแลกเปลี่ยน`);
    }

    // Sum holdings into per-class buckets. Each holding's notional value is
    // market_value (preferred) or qty × market_price (fallback). Currency
    // comes from the portfolio's reporting currency unless we have an
    // explicit class-level override below.
    const { results: holdings } = await env.DB.prepare(`
      SELECT symbol, quantity, market_price, market_value, asset_class
        FROM holdings
       WHERE portfolio_id = ?
    `).bind(p.id).all();

    for (const h of (holdings || [])) {
      const cls = h.asset_class || 'other';
      const nativeValue = h.market_value != null
        ? Number(h.market_value)
        : (h.quantity != null && h.market_price != null
            ? Number(h.quantity) * Number(h.market_price)
            : null);
      if (nativeValue == null) continue;
      // The class determines the *expected* currency; but if the portfolio
      // is reporting in a single broker currency, use that — it's the
      // authoritative number from the user's screen.
      const currency = portfolioCurrency;
      const thb = convertToThb(nativeValue, currency, rates);
      if (thb == null) continue;
      const slot = classTotals.get(cls) || { value_thb: 0, currencies: new Set() };
      slot.value_thb += thb;
      slot.currencies.add(currency);
      classTotals.set(cls, slot);
    }

    // Add cash directly into the cash class (assume cash is in the portfolio
    // currency, not the user's home currency).
    const cashThb = convertToThb(p.cash, portfolioCurrency, rates);
    if (cashThb != null && cashThb > 0) {
      const slot = classTotals.get('cash') || { value_thb: 0, currencies: new Set() };
      slot.value_thb += cashThb;
      slot.currencies.add(portfolioCurrency);
      classTotals.set('cash', slot);
    }

    portfolioRows.push({
      id: p.id,
      name: p.name,
      currency: portfolioCurrency,
      total_thb: portfolioTotalThb,
      total_native: p.total_value != null ? Number(p.total_value) : null,
      holding_count: (holdings || []).length,
    });
  }

  // If a portfolio.total_value exists but its holdings don't sum to the same
  // number (e.g. screenshot shows ฿1M total but the holdings rows only add
  // up to ฿800k), the per-class breakdown is incomplete. We prefer the
  // explicit total_value as the net-worth number — the breakdown is the
  // best-effort attribution.
  const breakdownTotal = [...classTotals.values()].reduce((s, v) => s + v.value_thb, 0);
  const portfoliosTotal = portfolioRows.reduce((s, p) => s + (p.total_thb || 0), 0);
  const totalThb = portfoliosTotal > 0 ? portfoliosTotal : breakdownTotal;

  // Build the breakdown array sorted by value desc.
  const breakdown = [...classTotals.entries()]
    .map(([cls, v]) => {
      const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
      return {
        class: cls,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        value_thb: v.value_thb,
        pct: totalThb > 0 ? (v.value_thb / totalThb) * 100 : 0,
        currency_mix: [...v.currencies],
      };
    })
    .sort((a, b) => b.value_thb - a.value_thb);

  // If holdings total exceeds portfolios total (or vice-versa) by >5%, flag.
  if (portfoliosTotal > 0 && breakdownTotal > 0) {
    const delta = Math.abs(portfoliosTotal - breakdownTotal) / portfoliosTotal;
    if (delta > 0.05) {
      warnings.push(
        `ผลรวมจากการ์ดต่างจากผลรวมรายตัว ~${Math.round(delta * 100)}% — ` +
        'บางพอร์ตอาจมีรายการที่ไม่ได้แตก asset_class',
      );
    }
  }

  return {
    total_thb: totalThb,
    breakdown,
    portfolios: portfolioRows,
    fx: rates,
    fx_fetched_at: fxFetchedAt?.ts || null,
    warnings,
  };
}

// Manual asset-class tag — used by the "ติด <SYM> <class>" command. Applies
// to every holding row for that symbol across all the user's portfolios.
export async function tagSymbolClass(env, userId, symbol, assetClass) {
  if (!symbol || !assetClass) return { ok: false, error: 'invalid_input' };
  const sym = String(symbol).toUpperCase().trim();
  const { meta } = await env.DB.prepare(`
    UPDATE holdings
       SET asset_class = ?
     WHERE symbol = ?
       AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = ?)
  `).bind(assetClass, sym, userId).run();
  return { ok: true, changed: meta?.changes || 0, symbol: sym, class: assetClass };
}

// Backfill: for any holding still on the legacy default ('thai_equity'),
// re-infer from the symbol if our heuristic disagrees. Called once after
// migration. Idempotent.
export async function backfillAssetClasses(env, userId, inferFn) {
  const { results } = await env.DB.prepare(`
    SELECT h.id, h.symbol, h.asset_class
      FROM holdings h
      JOIN portfolios p ON p.id = h.portfolio_id
     WHERE p.user_id = ?
  `).bind(userId).all();
  let changed = 0;
  for (const r of (results || [])) {
    const inferred = inferFn(r.symbol);
    if (inferred && inferred !== r.asset_class) {
      await env.DB.prepare(`UPDATE holdings SET asset_class = ? WHERE id = ?`)
        .bind(inferred, r.id)
        .run();
      changed++;
    }
  }
  return changed;
}
