// Read-only admin API routes for the portal at /admin.
// All routes are gated upstream (in src/index.js) by the same CRON_KEY check
// used for /test-* endpoints.

import {
  getDbCounts,
  getJourney,
  listAllPortfoliosWithSymbols,
  listAllUsersWithStats,
} from '../db.js';

export async function adminApiOverview(env) {
  const counts = await getDbCounts(env).catch(() => ({}));
  return jsonOk({ counts });
}

export async function adminApiUsers(env) {
  const users = await listAllUsersWithStats(env);
  return jsonOk({ count: users.length, users });
}

export async function adminApiPortfolios(env) {
  const portfolios = await listAllPortfoliosWithSymbols(env);
  return jsonOk({ count: portfolios.length, portfolios });
}

export async function adminApiJourney(env, url) {
  const userId = url.searchParams.get('userId');
  if (!userId) return jsonOk({ ok: false, error: 'userId required' }, 400);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 100));
  const events = await getJourney(env, userId, limit);
  return jsonOk({ userId, count: events.length, events });
}

export async function adminApiCronLogs(env) {
  const [alertLog, newsLog] = await Promise.all([
    env.SESSION_KV.get('cron:last-run'),
    env.SESSION_KV.get('news:last-run'),
  ]);
  return jsonOk({
    alert: alertLog ? safeParse(alertLog) : null,
    news: newsLog ? safeParse(newsLog) : null,
  });
}

function jsonOk(body, status = 200) {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}
