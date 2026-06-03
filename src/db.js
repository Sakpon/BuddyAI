import { inferAssetClass, isValidClass } from './assetclass.js';

// Vision tags asset_class per holding now; only fall back to the symbol
// heuristic when vision didn't supply a valid class.
const pickClass = (extracted, sym) =>
  isValidClass(extracted) ? extracted : inferAssetClass(sym);

export async function upsertUser(env, profile) {
  const { userId, displayName = null, pictureUrl = null, language = 'th' } = profile;
  await env.DB.prepare(
    `INSERT INTO users (user_id, display_name, picture_url, language)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       picture_url  = excluded.picture_url,
       language     = excluded.language,
       updated_at   = unixepoch()`,
  )
    .bind(userId, displayName, pictureUrl, language)
    .run();
}

export async function saveMessage(env, userId, role, content) {
  await env.DB.prepare(
    `INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)`,
  )
    .bind(userId, role, content)
    .run();
}

export async function getHistory(env, userId, limit = 12) {
  const { results } = await env.DB.prepare(
    `SELECT role, content
       FROM messages
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
  )
    .bind(userId, limit)
    .all();
  return (results || []).reverse();
}

export async function clearHistory(env, userId) {
  await env.DB.prepare(`DELETE FROM messages WHERE user_id = ?`)
    .bind(userId)
    .run();
}

export async function subscribeAlert(env, userId) {
  await env.DB.prepare(
    `UPDATE users SET alert_subscribed = 1, updated_at = unixepoch() WHERE user_id = ?`,
  )
    .bind(userId)
    .run();
}

export async function unsubscribeAlert(env, userId) {
  await env.DB.prepare(
    `UPDATE users SET alert_subscribed = 0, updated_at = unixepoch() WHERE user_id = ?`,
  )
    .bind(userId)
    .run();
}

export async function getSubscribedUsers(env) {
  const { results } = await env.DB.prepare(
    `SELECT user_id FROM users WHERE alert_subscribed = 1`,
  ).all();
  return (results || []).map((r) => r.user_id);
}

export async function subscribeNews(env, userId) {
  await env.DB.prepare(
    `UPDATE users SET news_subscribed = 1, updated_at = unixepoch() WHERE user_id = ?`,
  )
    .bind(userId)
    .run();
}

export async function unsubscribeNews(env, userId) {
  await env.DB.prepare(
    `UPDATE users SET news_subscribed = 0, updated_at = unixepoch() WHERE user_id = ?`,
  )
    .bind(userId)
    .run();
}

export async function getNewsSubscribedUsers(env) {
  const { results } = await env.DB.prepare(
    `SELECT user_id FROM users WHERE news_subscribed = 1`,
  ).all();
  return (results || []).map((r) => r.user_id);
}

const PENDING_PREFIX = 'pending-portfolio:';
const PENDING_TRANSACTIONS_PREFIX = 'pending-transactions:';
const PENDING_TTL = 60 * 30;

export async function savePendingPortfolio(env, userId, extracted) {
  await env.SESSION_KV.put(
    PENDING_PREFIX + userId,
    JSON.stringify(extracted),
    { expirationTtl: PENDING_TTL },
  );
}

export async function getPendingPortfolio(env, userId) {
  const raw = await env.SESSION_KV.get(PENDING_PREFIX + userId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function deletePendingPortfolio(env, userId) {
  await env.SESSION_KV.delete(PENDING_PREFIX + userId);
}

export async function confirmPendingPortfolio(env, userId, name) {
  const pending = await getPendingPortfolio(env, userId);
  if (!pending) return null;
  const finalName = (name && String(name).trim()) || defaultPortfolioName(pending);
  const portfolioId = await insertPortfolio(env, userId, pending, finalName);
  await deletePendingPortfolio(env, userId);
  return portfolioId;
}

function defaultPortfolioName(p) {
  const source = (p.source || 'พอร์ต').trim();
  const day = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
  }).format(new Date());
  return `${source} · ${day}`;
}

async function insertPortfolio(env, userId, p, name) {
  // Deactivate any other portfolios so the new one becomes the active.
  await env.DB.prepare(
    `UPDATE portfolios SET is_active = 0 WHERE user_id = ?`,
  ).bind(userId).run();

  // Backfill total_value from the sum of holdings when Claude vision missed
  // the total figure on the screenshot. Keeps the success card, history
  // timeline, and any other consumer of portfolios.total_value from
  // showing "—".
  const totalValue = numOrNull(p.total_value) ?? sumHoldingValuesForSave(p.holdings);

  const stmt = env.DB.prepare(
    `INSERT INTO portfolios (user_id, name, source, total_value, cash, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  ).bind(
    userId,
    name,
    p.source || null,
    totalValue,
    numOrNull(p.cash),
    p.warnings && p.warnings.length ? JSON.stringify(p.warnings) : null,
  );
  const { meta } = await stmt.run();
  const portfolioId = meta?.last_row_id;
  if (!portfolioId) throw new Error('insertPortfolio: no last_row_id');

  const holdings = Array.isArray(p.holdings) ? p.holdings : [];
  for (const h of holdings) {
    if (!h || !h.symbol) continue;
    await env.DB.prepare(
      `INSERT INTO holdings
        (portfolio_id, symbol, quantity, avg_cost, market_price,
         market_value, unrealized_pl, weight_pct, asset_class)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        portfolioId,
        String(h.symbol).toUpperCase(),
        numOrNull(h.quantity),
        numOrNull(h.avg_cost),
        numOrNull(h.market_price),
        numOrNull(h.market_value),
        numOrNull(h.unrealized_pl),
        numOrNull(h.weight_pct),
        pickClass(h.asset_class, String(h.symbol).toUpperCase()),
      )
      .run();
  }
  return portfolioId;
}

export async function getActivePortfolio(env, userId) {
  const portfolio = await env.DB.prepare(
    `SELECT id, name, source, total_value, cash, notes, taken_at, is_active
       FROM portfolios
      WHERE user_id = ?
        AND is_active = 1
      ORDER BY taken_at DESC, id DESC
      LIMIT 1`,
  )
    .bind(userId)
    .first();
  if (!portfolio) return null;
  const { results } = await env.DB.prepare(
    `SELECT symbol, quantity, avg_cost, market_price, market_value,
            unrealized_pl, weight_pct
       FROM holdings
      WHERE portfolio_id = ?`,
  )
    .bind(portfolio.id)
    .all();
  return { portfolio, holdings: results || [] };
}

export async function listPortfolios(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, source, total_value, taken_at, is_active
       FROM portfolios
      WHERE user_id = ?
      ORDER BY is_active DESC, taken_at DESC, id DESC`,
  )
    .bind(userId)
    .all();
  return results || [];
}

export async function getPortfolioWithHoldings(env, userId, portfolioId) {
  const portfolio = await env.DB.prepare(
    `SELECT id, name, source, total_value, cash, notes, taken_at, is_active
       FROM portfolios
      WHERE user_id = ? AND id = ?
      LIMIT 1`,
  )
    .bind(userId, portfolioId)
    .first();
  if (!portfolio) return null;
  const { results } = await env.DB.prepare(
    `SELECT symbol, quantity, avg_cost, market_price, market_value,
            unrealized_pl, weight_pct
       FROM holdings
      WHERE portfolio_id = ?`,
  )
    .bind(portfolio.id)
    .all();
  return { portfolio, holdings: results || [] };
}

export async function setActivePortfolio(env, userId, portfolioId) {
  // Atomic flip via CASE so exactly one row ends up is_active=1.
  const { meta } = await env.DB.prepare(
    `UPDATE portfolios
        SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END
      WHERE user_id = ?`,
  )
    .bind(portfolioId, userId)
    .run();
  return (meta?.changes || 0) > 0;
}

export async function renamePortfolio(env, userId, portfolioId, newName) {
  const trimmed = String(newName || '').trim();
  if (!trimmed) return false;
  const { meta } = await env.DB.prepare(
    `UPDATE portfolios SET name = ? WHERE id = ? AND user_id = ?`,
  )
    .bind(trimmed.slice(0, 60), portfolioId, userId)
    .run();
  return (meta?.changes || 0) > 0;
}

export async function deletePortfolioById(env, userId, portfolioId) {
  // Was this the active one? If yes, promote the next-most-recent.
  const wasActive = await env.DB.prepare(
    `SELECT is_active FROM portfolios WHERE id = ? AND user_id = ?`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!wasActive) return false;

  await env.DB.prepare(`DELETE FROM portfolios WHERE id = ? AND user_id = ?`)
    .bind(portfolioId, userId)
    .run();

  if (wasActive.is_active) {
    const next = await env.DB.prepare(
      `SELECT id FROM portfolios WHERE user_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1`,
    )
      .bind(userId)
      .first();
    if (next) {
      await env.DB.prepare(
        `UPDATE portfolios SET is_active = 1 WHERE id = ?`,
      )
        .bind(next.id)
        .run();
    }
  }
  return true;
}

export async function clearPortfolios(env, userId) {
  await env.DB.prepare(`DELETE FROM portfolios WHERE user_id = ?`)
    .bind(userId)
    .run();
  await deletePendingPortfolio(env, userId);
}

// "อัพเดต" flow: take the user's pending extraction and overwrite the given
// portfolio's totals + holdings with it, while archiving the prior state
// into portfolio_snapshots. Returns { portfolioId, snapshotId } on success.
export async function updatePortfolioFromPending(env, userId, portfolioId) {
  const pending = await getPendingPortfolio(env, userId);
  if (!pending) return null;

  // Verify the portfolio belongs to this user.
  const current = await env.DB.prepare(
    `SELECT id, total_value, cash, notes
       FROM portfolios
      WHERE id = ? AND user_id = ?`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!current) return null;

  // Snapshot current state (totals + holdings as JSON) before overwriting.
  const { results: currentHoldings } = await env.DB.prepare(
    `SELECT symbol, quantity, avg_cost, market_price, market_value,
            unrealized_pl, weight_pct
       FROM holdings
      WHERE portfolio_id = ?`,
  )
    .bind(portfolioId)
    .all();

  // Backfill the archived snapshot's total_value from the holdings being
  // archived so historic timeline points stay numeric even when the
  // original screenshot didn't give us a total.
  const archivedTotal = current.total_value != null
    ? current.total_value
    : sumHoldingValuesForSave(currentHoldings);

  const snapInsert = await env.DB.prepare(
    `INSERT INTO portfolio_snapshots (portfolio_id, total_value, cash, notes, holdings_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      portfolioId,
      archivedTotal,
      current.cash,
      current.notes,
      JSON.stringify(currentHoldings || []),
    )
    .run();
  const snapshotId = snapInsert?.meta?.last_row_id || null;

  // Same backfill for the incoming totals.
  const newTotal = numOrNull(pending.total_value) ?? sumHoldingValuesForSave(pending.holdings);

  // Overwrite portfolio totals.
  await env.DB.prepare(
    `UPDATE portfolios
        SET source = COALESCE(?, source),
            total_value = ?,
            cash = ?,
            notes = ?,
            taken_at = unixepoch()
      WHERE id = ?`,
  )
    .bind(
      pending.source || null,
      newTotal,
      numOrNull(pending.cash),
      pending.warnings && pending.warnings.length ? JSON.stringify(pending.warnings) : null,
      portfolioId,
    )
    .run();

  // Replace holdings.
  await env.DB.prepare(`DELETE FROM holdings WHERE portfolio_id = ?`)
    .bind(portfolioId)
    .run();

  const holdings = Array.isArray(pending.holdings) ? pending.holdings : [];
  for (const h of holdings) {
    if (!h || !h.symbol) continue;
    await env.DB.prepare(
      `INSERT INTO holdings
        (portfolio_id, symbol, quantity, avg_cost, market_price,
         market_value, unrealized_pl, weight_pct, asset_class)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        portfolioId,
        String(h.symbol).toUpperCase(),
        numOrNull(h.quantity),
        numOrNull(h.avg_cost),
        numOrNull(h.market_price),
        numOrNull(h.market_value),
        numOrNull(h.unrealized_pl),
        numOrNull(h.weight_pct),
        pickClass(h.asset_class, String(h.symbol).toUpperCase()),
      )
      .run();
  }

  await deletePendingPortfolio(env, userId);
  return { portfolioId, snapshotId };
}

export async function getPortfolioSnapshots(env, userId, portfolioId, limit = 20) {
  // Verify ownership cheaply.
  const owns = await env.DB.prepare(
    `SELECT 1 FROM portfolios WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!owns) return [];

  const { results } = await env.DB.prepare(
    `SELECT id, total_value, cash, holdings_json, taken_at
       FROM portfolio_snapshots
      WHERE portfolio_id = ?
      ORDER BY taken_at DESC, id DESC
      LIMIT ?`,
  )
    .bind(portfolioId, limit)
    .all();
  return (results || []).map((r) => ({
    id: r.id,
    total_value: r.total_value,
    cash: r.cash,
    taken_at: r.taken_at,
    holdings: r.holdings_json ? safeParse(r.holdings_json) : [],
  }));
}

export async function logEvent(env, userId, type, payload) {
  if (!userId || !type) return;
  try {
    await env.DB.prepare(
      `INSERT INTO events (user_id, type, payload) VALUES (?, ?, ?)`,
    )
      .bind(userId, type, payload == null ? null : JSON.stringify(payload))
      .run();
  } catch (err) {
    console.error('logEvent failed', type, err?.message || err);
  }
}

export async function getJourney(env, userId, limit = 100) {
  const { results } = await env.DB.prepare(
    `SELECT id, type, payload, created_at
       FROM events
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
  )
    .bind(userId, limit)
    .all();
  return (results || []).map((r) => ({
    id: r.id,
    type: r.type,
    created_at: r.created_at,
    payload: r.payload ? safeParse(r.payload) : null,
  }));
}

// ────────────────────────────────────────────────────────────────────────
// Buy / sell transactions on a portfolio.
//
// `transactions` is the append-only ledger; `holdings` continues to reflect
// the current position so analyse/rebalance/news queries don't need to
// re-derive it. Recording a trade does both in sequence.
// ────────────────────────────────────────────────────────────────────────

export async function recordBuy(env, userId, portfolioId, { symbol, quantity, price, fees = 0, notes = null }) {
  const sym = String(symbol || '').toUpperCase().trim();
  const qty = Number(quantity);
  const px  = Number(price);
  if (!sym || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
    return { ok: false, error: 'invalid_input' };
  }

  const owns = await env.DB.prepare(
    `SELECT id FROM portfolios WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!owns) return { ok: false, error: 'portfolio_not_found' };

  const txInsert = await env.DB.prepare(
    `INSERT INTO transactions (user_id, portfolio_id, symbol, side, quantity, price, fees, notes)
     VALUES (?, ?, ?, 'BUY', ?, ?, ?, ?)`,
  )
    .bind(userId, portfolioId, sym, qty, px, numOrNull(fees) || 0, notes || null)
    .run();
  const txId = txInsert?.meta?.last_row_id || null;

  const existing = await env.DB.prepare(
    `SELECT id, quantity, avg_cost FROM holdings WHERE portfolio_id = ? AND symbol = ? LIMIT 1`,
  )
    .bind(portfolioId, sym)
    .first();

  let newQty, newAvg;
  if (existing) {
    const oldQty = Number(existing.quantity) || 0;
    const oldAvg = Number(existing.avg_cost) || 0;
    newQty = oldQty + qty;
    newAvg = newQty > 0 ? ((oldQty * oldAvg) + (qty * px)) / newQty : px;
    await env.DB.prepare(
      `UPDATE holdings SET quantity = ?, avg_cost = ? WHERE id = ?`,
    )
      .bind(newQty, newAvg, existing.id)
      .run();
  } else {
    newQty = qty;
    newAvg = px;
    await env.DB.prepare(
      `INSERT INTO holdings (portfolio_id, symbol, quantity, avg_cost, market_price)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(portfolioId, sym, qty, px, px)
      .run();
  }

  return {
    ok: true,
    txId,
    symbol: sym,
    side: 'BUY',
    quantity: qty,
    price: px,
    fees: Number(fees) || 0,
    total: qty * px + (Number(fees) || 0),
    position: { quantity: newQty, avg_cost: newAvg },
  };
}

export async function recordSell(env, userId, portfolioId, { symbol, quantity, price, fees = 0, notes = null }) {
  const sym = String(symbol || '').toUpperCase().trim();
  const qty = Number(quantity);
  const px  = Number(price);
  if (!sym || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
    return { ok: false, error: 'invalid_input' };
  }

  const owns = await env.DB.prepare(
    `SELECT id FROM portfolios WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!owns) return { ok: false, error: 'portfolio_not_found' };

  const existing = await env.DB.prepare(
    `SELECT id, quantity, avg_cost FROM holdings WHERE portfolio_id = ? AND symbol = ? LIMIT 1`,
  )
    .bind(portfolioId, sym)
    .first();
  if (!existing) return { ok: false, error: 'no_position' };

  const oldQty = Number(existing.quantity) || 0;
  if (qty > oldQty + 1e-9) return { ok: false, error: 'insufficient_quantity', held: oldQty };

  const oldAvg = Number(existing.avg_cost) || 0;
  const fee = numOrNull(fees) || 0;
  const realizedPl = (px - oldAvg) * qty - fee;

  const txInsert = await env.DB.prepare(
    `INSERT INTO transactions (user_id, portfolio_id, symbol, side, quantity, price, fees, realized_pl, notes)
     VALUES (?, ?, ?, 'SELL', ?, ?, ?, ?, ?)`,
  )
    .bind(userId, portfolioId, sym, qty, px, fee, realizedPl, notes || null)
    .run();
  const txId = txInsert?.meta?.last_row_id || null;

  const newQty = oldQty - qty;
  if (newQty <= 1e-9) {
    await env.DB.prepare(`DELETE FROM holdings WHERE id = ?`).bind(existing.id).run();
  } else {
    // Selling does not change average cost.
    await env.DB.prepare(`UPDATE holdings SET quantity = ? WHERE id = ?`)
      .bind(newQty, existing.id)
      .run();
  }

  return {
    ok: true,
    txId,
    symbol: sym,
    side: 'SELL',
    quantity: qty,
    price: px,
    fees: fee,
    total: qty * px - fee,
    realized_pl: realizedPl,
    avg_cost: oldAvg,
    position: { quantity: newQty > 1e-9 ? newQty : 0, avg_cost: newQty > 1e-9 ? oldAvg : 0 },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Bulk transaction import from a vision-extracted screenshot.
// The KV-backed pending blob mirrors the pending-portfolio flow — list lives
// in KV with a 30-min TTL until the user taps "บันทึกทั้งหมด".
// ────────────────────────────────────────────────────────────────────────

export async function savePendingTransactions(env, userId, payload) {
  // Default each transaction to selected=true so the bulk-confirm flow
  // continues to work as a single tap. Per-row toggling can flip individual
  // entries off via togglePendingTransactionSelection.
  const transactions = Array.isArray(payload?.transactions) ? payload.transactions : [];
  const blob = {
    ...payload,
    selected: transactions.map(() => true),
  };
  await env.SESSION_KV.put(
    PENDING_TRANSACTIONS_PREFIX + userId,
    JSON.stringify(blob),
    { expirationTtl: PENDING_TTL },
  );
}

export async function getPendingTransactions(env, userId) {
  const raw = await env.SESSION_KV.get(PENDING_TRANSACTIONS_PREFIX + userId);
  if (!raw) return null;
  try {
    const blob = JSON.parse(raw);
    // Back-compat: blobs saved before the selected[] field exists default
    // every row to selected.
    if (!Array.isArray(blob.selected) && Array.isArray(blob.transactions)) {
      blob.selected = blob.transactions.map(() => true);
    }
    return blob;
  } catch { return null; }
}

export async function deletePendingTransactions(env, userId) {
  await env.SESSION_KV.delete(PENDING_TRANSACTIONS_PREFIX + userId);
}

// Flip the per-row selected flag. Returns the updated blob (or null if no
// pending list exists). Out-of-range idx is a no-op.
export async function togglePendingTransactionSelection(env, userId, idx) {
  const blob = await getPendingTransactions(env, userId);
  if (!blob || !Array.isArray(blob.transactions)) return null;
  const i = Number(idx);
  if (!Number.isInteger(i) || i < 0 || i >= blob.transactions.length) return blob;
  blob.selected[i] = !blob.selected[i];
  await env.SESSION_KV.put(
    PENDING_TRANSACTIONS_PREFIX + userId,
    JSON.stringify(blob),
    { expirationTtl: PENDING_TTL },
  );
  return blob;
}

// Apply the user's pending transaction list to the active portfolio.
// Iterates in chronological order (oldest first) so SELLs see prior BUYs.
// SELLs that reference a symbol with no position are skipped, not aborted,
// and surfaced in the `errors` array for the caller to render.
export async function applyPendingTransactions(env, userId, portfolioId) {
  const pending = await getPendingTransactions(env, userId);
  if (!pending || !Array.isArray(pending.transactions)) return null;

  // Verify ownership.
  const owns = await env.DB.prepare(
    `SELECT id FROM portfolios WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!owns) return null;

  // Filter to rows the user has explicitly selected (default is all-selected
  // if the blob predates per-row selection). Then sort ascending by parsed
  // timestamp; rows without a timestamp go last (they're least likely to
  // depend on prior rows).
  const selected = Array.isArray(pending.selected)
    ? pending.selected
    : pending.transactions.map(() => true);
  const sorted = pending.transactions
    .map((t, idx) => ({ ...t, _idx: idx, _ts: parseExecutedAt(t.executed_at) }))
    .filter((t) => selected[t._idx] !== false)
    .sort((a, b) => {
      if (a._ts == null && b._ts == null) return a._idx - b._idx;
      if (a._ts == null) return 1;
      if (b._ts == null) return -1;
      return a._ts - b._ts;
    });

  const applied = [];
  const skipped = [];
  const errors = [];

  for (const t of sorted) {
    const side = String(t.side || '').toUpperCase();
    const symbol = String(t.symbol || '').toUpperCase().trim();
    const quantity = Number(t.quantity);
    const price = Number(t.price);
    const executed_at = t._ts;

    if (!symbol || !Number.isFinite(quantity) || quantity <= 0
        || !Number.isFinite(price) || price <= 0) {
      skipped.push({ row: t, reason: 'missing_qty_or_price' });
      continue;
    }

    const fn = side === 'BUY' ? recordBuy
             : side === 'SELL' ? recordSell
             : null;
    if (!fn) {
      skipped.push({ row: t, reason: 'unknown_side' });
      continue;
    }

    const result = await fn(env, userId, portfolioId, {
      symbol, quantity, price,
      notes: pending.source ? `Imported from ${pending.source}` : 'Imported',
    });

    if (!result?.ok) {
      errors.push({ row: t, error: result?.error || 'unknown' });
      continue;
    }

    // If the import row had a timestamp, override the auto-set executed_at
    // so the journey reflects when it actually happened.
    if (executed_at != null && result.txId) {
      await env.DB.prepare(
        `UPDATE transactions SET executed_at = ? WHERE id = ?`,
      )
        .bind(executed_at, result.txId)
        .run();
    }

    applied.push({ side, symbol, quantity, price, executed_at, txId: result.txId });
  }

  await deletePendingTransactions(env, userId);
  return { applied, skipped, errors };
}

function parseExecutedAt(s) {
  if (!s) return null;
  // Expecting "YYYY-MM-DD HH:MM" in Asia/Bangkok. Treat as UTC+7 so the
  // unix epoch we store reflects the actual moment the trade happened.
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, y, mo, d, h, mi] = m;
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h - 7, +mi); // BKK = UTC+7
  return Math.floor(utcMs / 1000);
}

export async function listTransactions(env, userId, portfolioId, limit = 50) {
  const owns = await env.DB.prepare(
    `SELECT 1 FROM portfolios WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!owns) return [];

  const { results } = await env.DB.prepare(
    `SELECT id, symbol, side, quantity, price, fees, realized_pl, notes, executed_at
       FROM transactions
      WHERE portfolio_id = ?
      ORDER BY executed_at DESC, id DESC
      LIMIT ?`,
  )
    .bind(portfolioId, limit)
    .all();
  return results || [];
}

// Trading-diary aggregate: realized P/L, win-rate, best/worst, recent closed
// trades. SELLs are "closed trades" — each one carries `realized_pl` computed
// at sell time against the running average cost (see recordSell).
//
// `opts.days` (number|null) — limit to last N days. null = all-time.
// `opts.symbol` (string|null) — filter to a single symbol (uppercased).
export async function getTradingDiary(env, userId, portfolioId, opts = {}) {
  const owns = await env.DB.prepare(
    `SELECT id, name FROM portfolios WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(portfolioId, userId)
    .first();
  if (!owns) return null;

  const sinceClause = opts.days
    ? `AND executed_at >= unixepoch('now', '-${Number(opts.days)} days')`
    : '';
  const symbolClause = opts.symbol ? 'AND symbol = ?' : '';
  const symbolBind = opts.symbol ? [String(opts.symbol).toUpperCase()] : [];

  // Aggregate stats — only SELLs count as closed trades.
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) AS closed_count,
      SUM(CASE WHEN realized_pl > 0 THEN 1 ELSE 0 END) AS win_count,
      SUM(CASE WHEN realized_pl <= 0 THEN 1 ELSE 0 END) AS loss_count,
      COALESCE(SUM(realized_pl), 0) AS total_realized_pl,
      COALESCE(SUM(quantity * price), 0) AS turnover
    FROM transactions
    WHERE portfolio_id = ? AND side = 'SELL' ${sinceClause} ${symbolClause}
  `).bind(portfolioId, ...symbolBind).first();

  // Open positions count (current state of `holdings`).
  const openPos = await env.DB.prepare(`
    SELECT COUNT(*) AS n FROM holdings WHERE portfolio_id = ? AND quantity > 0
       ${opts.symbol ? 'AND symbol = ?' : ''}
  `).bind(portfolioId, ...symbolBind).first();

  // Best winner + worst loser within scope.
  const best = await env.DB.prepare(`
    SELECT id, symbol, quantity, price, realized_pl, executed_at
      FROM transactions
     WHERE portfolio_id = ? AND side = 'SELL' AND realized_pl IS NOT NULL
       ${sinceClause} ${symbolClause}
     ORDER BY realized_pl DESC
     LIMIT 1
  `).bind(portfolioId, ...symbolBind).first();

  const worst = await env.DB.prepare(`
    SELECT id, symbol, quantity, price, realized_pl, executed_at
      FROM transactions
     WHERE portfolio_id = ? AND side = 'SELL' AND realized_pl IS NOT NULL
       ${sinceClause} ${symbolClause}
     ORDER BY realized_pl ASC
     LIMIT 1
  `).bind(portfolioId, ...symbolBind).first();

  // Recent closed trades — last 8 SELLs in scope.
  const { results: recent } = await env.DB.prepare(`
    SELECT id, symbol, quantity, price, realized_pl, executed_at
      FROM transactions
     WHERE portfolio_id = ? AND side = 'SELL'
       ${sinceClause} ${symbolClause}
     ORDER BY executed_at DESC, id DESC
     LIMIT 8
  `).bind(portfolioId, ...symbolBind).all();

  // Holding period for best/worst — earliest BUY of that symbol in this
  // portfolio before the SELL. Approximate (weighted-avg cost basis).
  const enrichHolding = async (row) => {
    if (!row) return null;
    const earliestBuy = await env.DB.prepare(`
      SELECT MIN(executed_at) AS first_buy_at
        FROM transactions
       WHERE portfolio_id = ? AND symbol = ? AND side = 'BUY'
         AND executed_at <= ?
    `).bind(portfolioId, row.symbol, row.executed_at).first();
    const firstBuyAt = earliestBuy?.first_buy_at;
    const holdingDays = firstBuyAt
      ? Math.max(0, Math.round((row.executed_at - firstBuyAt) / 86400))
      : null;
    return { ...row, holding_days: holdingDays };
  };

  return {
    portfolio: { id: owns.id, name: owns.name },
    scope: { days: opts.days || null, symbol: opts.symbol || null },
    stats: {
      closed_count: stats?.closed_count || 0,
      win_count: stats?.win_count || 0,
      loss_count: stats?.loss_count || 0,
      total_realized_pl: stats?.total_realized_pl || 0,
      turnover: stats?.turnover || 0,
      open_positions: openPos?.n || 0,
    },
    best: await enrichHolding(best),
    worst: await enrichHolding(worst),
    recent: recent || [],
  };
}

// ────────────────────────────────────────────────────────────────────────
// AIWealthOS Phase 1.2 — goals + DCA contributions
//
// One active goal per user (free-tier limit). saveGoal atomically deactivates
// any prior active goal so the user sees only the current one in their card.
// Contributions are append-only and survive goal re-creation via the
// nullable goal_id FK (existing rows get NULL on goal delete).
// ────────────────────────────────────────────────────────────────────────

export async function saveGoal(env, userId, goal) {
  const {
    targetAmountThb,
    targetYear,
    expectedReturnPct,
    monthlyContributionThb,
    allocationTargets,
  } = goal;
  if (!Number.isFinite(targetAmountThb) || !Number.isInteger(targetYear) || !Number.isFinite(monthlyContributionThb)) {
    return { ok: false, error: 'invalid_input' };
  }

  // Deactivate any existing active goal so this becomes the single active.
  await env.DB.prepare(
    `UPDATE goals SET is_active = 0, updated_at = unixepoch() WHERE user_id = ? AND is_active = 1`,
  ).bind(userId).run();

  const { meta } = await env.DB.prepare(
    `INSERT INTO goals
       (user_id, target_amount_thb, target_year, expected_return_pct,
        monthly_contribution_thb, allocation_targets_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  )
    .bind(
      userId,
      Number(targetAmountThb),
      Number(targetYear),
      Number(expectedReturnPct) || 6.5,
      Number(monthlyContributionThb),
      JSON.stringify(allocationTargets || {}),
    )
    .run();
  return { ok: true, goalId: meta?.last_row_id };
}

export async function getActiveGoal(env, userId) {
  const row = await env.DB.prepare(
    `SELECT id, target_amount_thb, target_year, expected_return_pct,
            monthly_contribution_thb, allocation_targets_json,
            created_at, updated_at
       FROM goals
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  )
    .bind(userId)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    targetAmountThb: row.target_amount_thb,
    targetYear: row.target_year,
    expectedReturnPct: row.expected_return_pct,
    monthlyContributionThb: row.monthly_contribution_thb,
    allocationTargets: row.allocation_targets_json
      ? safeParse(row.allocation_targets_json) || {}
      : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ────────────────────────────────────────────────────────────────────────
// AIWealthOS Phase 3 — dividend ledger
// ────────────────────────────────────────────────────────────────────────

export async function recordDividend(env, userId, payload) {
  const symbol = String(payload?.symbol || '').toUpperCase().trim();
  const amountThb = Number(payload?.amountThb);
  if (!symbol || !Number.isFinite(amountThb) || amountThb <= 0) {
    return { ok: false, error: 'invalid_input' };
  }
  // Resolve portfolio_id from active portfolio if not explicitly supplied.
  const portfolioId = payload?.portfolioId ?? null;
  const perShare = payload?.perShare != null ? Number(payload.perShare) : null;
  const quantity = payload?.quantity != null ? Number(payload.quantity) : null;
  const withholdingTaxThb = payload?.withholdingTaxThb != null ? Number(payload.withholdingTaxThb) : 0;
  const exDate = payload?.exDate ?? null;
  const payDate = payload?.payDate ?? null;
  const notes = payload?.notes ?? null;

  const { meta } = await env.DB.prepare(
    `INSERT INTO dividends
       (user_id, portfolio_id, symbol, amount_thb, per_share, quantity,
        withholding_tax_thb, ex_date, pay_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, unixepoch()), ?)`,
  )
    .bind(
      userId,
      portfolioId,
      symbol,
      amountThb,
      perShare,
      quantity,
      withholdingTaxThb,
      exDate,
      payDate,
      notes,
    )
    .run();
  return { ok: true, dividendId: meta?.last_row_id, symbol, amountThb };
}

export async function listDividends(env, userId, limit = 20) {
  const { results } = await env.DB.prepare(
    `SELECT id, portfolio_id, symbol, amount_thb, per_share, quantity,
            withholding_tax_thb, ex_date, pay_date, status, notes, created_at
       FROM dividends
      WHERE user_id = ?
      ORDER BY pay_date DESC, id DESC
      LIMIT ?`,
  )
    .bind(userId, limit)
    .all();
  return results || [];
}

// Year-to-date dividend total + per-symbol top contributors. Drives the
// "ปันผลปีนี้" summary panel on the list card.
export async function getDividendsYtd(env, userId, now = new Date()) {
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const bkk = new Date(bkkMs);
  const yearStartBkkMs = Date.UTC(bkk.getUTCFullYear(), 0, 1);
  const yearStartUnix = Math.floor((yearStartBkkMs - 7 * 60 * 60 * 1000) / 1000);

  const totalRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_thb), 0) AS total,
            COALESCE(SUM(withholding_tax_thb), 0) AS tax_total,
            COUNT(*) AS n
       FROM dividends WHERE user_id = ? AND pay_date >= ?`,
  )
    .bind(userId, yearStartUnix)
    .first();

  const { results: bySymbol } = await env.DB.prepare(
    `SELECT symbol, SUM(amount_thb) AS total
       FROM dividends WHERE user_id = ? AND pay_date >= ?
       GROUP BY symbol
       ORDER BY total DESC
       LIMIT 5`,
  )
    .bind(userId, yearStartUnix)
    .all();

  return {
    year: bkk.getUTCFullYear(),
    total: Number(totalRow?.total || 0),
    tax_total: Number(totalRow?.tax_total || 0),
    count: Number(totalRow?.n || 0),
    by_symbol: (bySymbol || []).map((r) => ({
      symbol: r.symbol,
      total: Number(r.total || 0),
    })),
  };
}

export async function getDividendsTotalAllTime(env, userId) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_thb), 0) AS total FROM dividends WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  return Number(row?.total || 0);
}

// Used by the nudge cron — returns every user_id with an active goal so we
// can fan-out drift checks + DCA reminders without scanning the full user
// table.
export async function getUsersWithActiveGoals(env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT user_id FROM goals WHERE is_active = 1`,
  ).all();
  return (results || []).map((r) => r.user_id);
}

export async function clearActiveGoal(env, userId) {
  const { meta } = await env.DB.prepare(
    `UPDATE goals SET is_active = 0, updated_at = unixepoch()
      WHERE user_id = ? AND is_active = 1`,
  )
    .bind(userId)
    .run();
  return (meta?.changes || 0) > 0;
}

// ────────────────────────────────────────────────────────────────────────
// Per-month DCA overrides (Phase 1.2 follow-on)
//
// The goal carries a single standing monthly DCA. Overrides let the user
// say "this specific month, my DCA is different" — e.g. bonus month at
// ฿80K instead of the usual ฿30K. The nudge cron + the goal-log-monthly
// postback both read from this table when picking the amount to suggest.
// ────────────────────────────────────────────────────────────────────────

export async function setDcaOverride(env, userId, goalId, yearMonth, amountThb, notes = null) {
  const ym = String(yearMonth || '').trim();
  const amt = Number(amountThb);
  if (!ym.match(/^\d{4}-\d{2}$/)) return { ok: false, error: 'invalid_year_month' };
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: 'invalid_amount' };
  // SQLite-flavored upsert — keeps a single row per (user, goal, month).
  await env.DB.prepare(
    `INSERT INTO dca_overrides (user_id, goal_id, year_month, amount_thb, notes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, goal_id, year_month)
     DO UPDATE SET amount_thb = excluded.amount_thb,
                   notes = excluded.notes,
                   updated_at = unixepoch()`,
  )
    .bind(userId, goalId, ym, amt, notes)
    .run();
  return { ok: true, year_month: ym, amount_thb: amt };
}

export async function getDcaOverride(env, userId, goalId, yearMonth) {
  if (!goalId || !yearMonth) return null;
  const row = await env.DB.prepare(
    `SELECT id, year_month, amount_thb, notes, updated_at
       FROM dca_overrides
      WHERE user_id = ? AND goal_id = ? AND year_month = ?
      LIMIT 1`,
  )
    .bind(userId, goalId, yearMonth)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    year_month: row.year_month,
    amount_thb: Number(row.amount_thb),
    notes: row.notes,
    updated_at: row.updated_at,
  };
}

// Future-first list — overrides for upcoming months at the top, then past
// months. Useful for the dcaOverridesCard ("ตารางการเติม DCA").
export async function listDcaOverrides(env, userId, goalId, limit = 24) {
  if (!goalId) return [];
  const { results } = await env.DB.prepare(
    `SELECT id, year_month, amount_thb, notes, updated_at
       FROM dca_overrides
      WHERE user_id = ? AND goal_id = ?
      ORDER BY year_month DESC, id DESC
      LIMIT ?`,
  )
    .bind(userId, goalId, limit)
    .all();
  return (results || []).map((r) => ({
    id: r.id,
    year_month: r.year_month,
    amount_thb: Number(r.amount_thb),
    notes: r.notes,
    updated_at: r.updated_at,
  }));
}

export async function deleteDcaOverride(env, userId, goalId, yearMonth) {
  if (!goalId || !yearMonth) return { ok: false, error: 'invalid_input' };
  const { meta } = await env.DB.prepare(
    `DELETE FROM dca_overrides
      WHERE user_id = ? AND goal_id = ? AND year_month = ?`,
  )
    .bind(userId, goalId, yearMonth)
    .run();
  return { ok: true, deleted: (meta?.changes || 0) > 0 };
}

// Partial in-place edit of the active goal. Accepts any subset of:
//   { targetAmountThb, targetYear, expectedReturnPct, allocationTargets,
//     monthlyContributionThb }
// Caller is responsible for re-running the PMT back-solver when any of
// amount/year/return change — keeps this helper agnostic to the math.
//
// Returns { ok, changed, goal } where `goal` is the freshly-fetched
// active goal (so the caller can render the updated card without a second
// query).
export async function updateGoalFields(env, userId, patch) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) return { ok: false, error: 'no_active_goal' };

  const fields = [];
  const values = [];
  if (patch.targetAmountThb != null && Number.isFinite(Number(patch.targetAmountThb))) {
    fields.push('target_amount_thb = ?');
    values.push(Number(patch.targetAmountThb));
  }
  if (patch.targetYear != null && Number.isInteger(Number(patch.targetYear))) {
    fields.push('target_year = ?');
    values.push(Number(patch.targetYear));
  }
  if (patch.expectedReturnPct != null && Number.isFinite(Number(patch.expectedReturnPct))) {
    fields.push('expected_return_pct = ?');
    values.push(Number(patch.expectedReturnPct));
  }
  if (patch.monthlyContributionThb != null && Number.isFinite(Number(patch.monthlyContributionThb))) {
    fields.push('monthly_contribution_thb = ?');
    values.push(Number(patch.monthlyContributionThb));
  }
  if (patch.allocationTargets && typeof patch.allocationTargets === 'object') {
    fields.push('allocation_targets_json = ?');
    values.push(JSON.stringify(patch.allocationTargets));
  }

  if (!fields.length) return { ok: true, changed: false, goal };

  fields.push('updated_at = unixepoch()');
  values.push(goal.id, userId);

  const { meta } = await env.DB.prepare(
    `UPDATE goals SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ? AND is_active = 1`,
  )
    .bind(...values)
    .run();

  const updated = await getActiveGoal(env, userId);
  return { ok: true, changed: (meta?.changes || 0) > 0, goal: updated };
}

export async function recordContribution(env, userId, { goalId, assetClass, amountThb, notes }) {
  if (!Number.isFinite(amountThb) || amountThb <= 0) return { ok: false, error: 'invalid_input' };
  if (!assetClass) return { ok: false, error: 'invalid_input' };
  const { meta } = await env.DB.prepare(
    `INSERT INTO contributions (user_id, goal_id, asset_class, amount_thb, notes)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(userId, goalId || null, assetClass, Number(amountThb), notes || null)
    .run();
  return { ok: true, contributionId: meta?.last_row_id };
}

// Sum of all contributions ever attributed to a given goal — used by the
// "you've put in X / monthly should have been Y" display.
export async function getContributionsTotal(env, userId, goalId) {
  if (!goalId) return 0;
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_thb), 0) AS total
       FROM contributions WHERE user_id = ? AND goal_id = ?`,
  )
    .bind(userId, goalId)
    .first();
  return Number(row?.total || 0);
}

// Count of distinct calendar months (Asia/Bangkok) that have at least one
// contribution. Drives the "📅 จำนวนเดือนที่เติม DCA" line on the goal card,
// which is more useful than monthsElapsed for showing actual discipline.
export async function getContributionMonthsCount(env, userId, goalId) {
  if (!goalId) return 0;
  const row = await env.DB.prepare(
    `SELECT COUNT(DISTINCT strftime('%Y-%m', contributed_at + 25200, 'unixepoch')) AS n
       FROM contributions WHERE user_id = ? AND goal_id = ?`,
  )
    .bind(userId, goalId)
    .first();
  return Number(row?.n || 0);
}

// Per-class contribution split — drives the "DCA adherence by class" view.
export async function getContributionsByClass(env, userId, goalId) {
  if (!goalId) return {};
  const { results } = await env.DB.prepare(
    `SELECT asset_class, COALESCE(SUM(amount_thb), 0) AS total
       FROM contributions WHERE user_id = ? AND goal_id = ?
       GROUP BY asset_class`,
  )
    .bind(userId, goalId)
    .all();
  const map = {};
  for (const r of (results || [])) map[r.asset_class] = Number(r.total || 0);
  return map;
}

// Sum of this-calendar-month's contributions, in Asia/Bangkok. Used by the
// weekly status digest to flag "DCA เดือนนี้ยังไม่ครบ" without scanning
// every contribution row in JS.
export async function getContributionsThisMonth(env, userId, goalId, now = new Date()) {
  if (!goalId) return 0;
  // Compute Bangkok month-start as a unix timestamp.
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const bkk = new Date(bkkMs);
  const monthStartBkkMs = Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1);
  const monthStartUnix = Math.floor((monthStartBkkMs - 7 * 60 * 60 * 1000) / 1000);
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_thb), 0) AS total
       FROM contributions
      WHERE user_id = ? AND goal_id = ?
        AND contributed_at >= ?`,
  )
    .bind(userId, goalId, monthStartUnix)
    .first();
  return Number(row?.total || 0);
}

// Recent contributions feed — most-recent N for the goal card and journey.
export async function listContributions(env, userId, goalId, limit = 12) {
  const { results } = await env.DB.prepare(
    `SELECT id, asset_class, amount_thb, notes, contributed_at
       FROM contributions
      WHERE user_id = ?
        AND (? IS NULL OR goal_id = ?)
      ORDER BY contributed_at DESC, id DESC
      LIMIT ?`,
  )
    .bind(userId, goalId || null, goalId || null, limit)
    .all();
  return results || [];
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Sum of holdings' market_value (or quantity × market_price fallback). Used
// at portfolio insert/update time to backfill portfolios.total_value /
// portfolio_snapshots.total_value when the screenshot didn't surface a
// total figure (Dime!/Grab Invest layouts are a common case). Returns null
// when nothing useful can be summed so we don't claim a portfolio is worth
// 0 baht.
function sumHoldingValuesForSave(holdings) {
  if (!Array.isArray(holdings) || !holdings.length) return null;
  let sum = 0;
  let any = false;
  for (const h of holdings) {
    if (!h) continue;
    let v = numOrNull(h.market_value);
    if (v == null) {
      const q = numOrNull(h.quantity);
      const p = numOrNull(h.market_price);
      v = (q != null && p != null) ? q * p : null;
    }
    if (v != null) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : null;
}

// ────────────────────────────────────────────────────────────────────────
// Admin-portal queries.
//
// These joins are read-only and small — fine for personal-bot scale.
// ────────────────────────────────────────────────────────────────────────

export async function listAllUsersWithStats(env) {
  const { results } = await env.DB.prepare(`
    SELECT
      u.user_id,
      u.display_name,
      u.alert_subscribed,
      u.news_subscribed,
      u.created_at,
      u.updated_at,
      (SELECT COUNT(*) FROM portfolios p WHERE p.user_id = u.user_id) AS portfolio_count,
      (SELECT COUNT(*) FROM messages  m WHERE m.user_id = u.user_id) AS message_count,
      (SELECT COUNT(*) FROM events    e WHERE e.user_id = u.user_id) AS event_count,
      (SELECT MAX(created_at) FROM events e WHERE e.user_id = u.user_id) AS last_event_at
    FROM users u
    ORDER BY COALESCE(last_event_at, u.updated_at) DESC, u.created_at DESC
    LIMIT 200
  `).all();
  return results || [];
}

export async function listAllPortfoliosWithSymbols(env) {
  const { results } = await env.DB.prepare(`
    SELECT
      p.id,
      p.user_id,
      p.name,
      p.source,
      p.total_value,
      p.is_active,
      p.taken_at,
      (SELECT COUNT(*) FROM holdings h WHERE h.portfolio_id = p.id) AS holding_count,
      (SELECT GROUP_CONCAT(h.symbol, ',')
         FROM holdings h
         WHERE h.portfolio_id = p.id) AS symbols
    FROM portfolios p
    ORDER BY p.taken_at DESC, p.id DESC
    LIMIT 200
  `).all();
  return (results || []).map((r) => ({
    ...r,
    symbols: r.symbols ? r.symbols.split(',').filter(Boolean) : [],
  }));
}

export async function getDbCounts(env) {
  const tables = ['users', 'portfolios', 'holdings', 'messages', 'events'];
  const out = {};
  for (const t of tables) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first();
    out[t] = row?.n ?? 0;
  }
  return out;
}
