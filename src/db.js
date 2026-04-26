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
