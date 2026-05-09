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

  const stmt = env.DB.prepare(
    `INSERT INTO portfolios (user_id, name, source, total_value, cash, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  ).bind(
    userId,
    name,
    p.source || null,
    numOrNull(p.total_value),
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
         market_value, unrealized_pl, weight_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

  const snapInsert = await env.DB.prepare(
    `INSERT INTO portfolio_snapshots (portfolio_id, total_value, cash, notes, holdings_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      portfolioId,
      current.total_value,
      current.cash,
      current.notes,
      JSON.stringify(currentHoldings || []),
    )
    .run();
  const snapshotId = snapInsert?.meta?.last_row_id || null;

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
      numOrNull(pending.total_value),
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
         market_value, unrealized_pl, weight_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  await env.SESSION_KV.put(
    PENDING_TRANSACTIONS_PREFIX + userId,
    JSON.stringify(payload),
    { expirationTtl: PENDING_TTL },
  );
}

export async function getPendingTransactions(env, userId) {
  const raw = await env.SESSION_KV.get(PENDING_TRANSACTIONS_PREFIX + userId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function deletePendingTransactions(env, userId) {
  await env.SESSION_KV.delete(PENDING_TRANSACTIONS_PREFIX + userId);
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

  // Sort ascending by parsed timestamp; rows without a timestamp go last
  // (they're least likely to depend on prior rows).
  const sorted = [...pending.transactions]
    .map((t, idx) => ({ ...t, _idx: idx, _ts: parseExecutedAt(t.executed_at) }))
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

function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
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
