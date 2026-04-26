const PREFIX = 'session:';
const TTL = 60 * 60;

export async function getSession(env, userId) {
  const raw = await env.SESSION_KV.get(PREFIX + userId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setSession(env, userId, data) {
  await env.SESSION_KV.put(PREFIX + userId, JSON.stringify(data), {
    expirationTtl: TTL,
  });
}

export async function deleteSession(env, userId) {
  await env.SESSION_KV.delete(PREFIX + userId);
}
