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

function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
