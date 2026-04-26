const API = 'https://api.line.me/v2/bot';

export async function verifySignature(secret, signatureHeader, rawBody) {
  if (!signatureHeader || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return timingSafeEqual(expected, signatureHeader);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function textMsg(text) {
  return { type: 'text', text: String(text).slice(0, 5000) };
}

export function quickReply(text, items) {
  return {
    ...textMsg(text),
    quickReply: {
      items: items.map((it) => ({
        type: 'action',
        action: { type: 'message', label: it.label, text: it.text || it.label },
      })),
    },
  };
}

export async function reply(env, replyToken, messages) {
  const res = await fetch(`${API}/message/reply`, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify({
      replyToken,
      messages: Array.isArray(messages) ? messages : [messages],
    }),
  });
  if (!res.ok) console.error('LINE reply', res.status, await res.text());
  return res.ok;
}

export async function push(env, to, messages) {
  const res = await fetch(`${API}/message/push`, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify({
      to,
      messages: Array.isArray(messages) ? messages : [messages],
    }),
  });
  if (!res.ok) console.error('LINE push', res.status, await res.text());
  return res.ok;
}

export async function showLoading(env, chatId, seconds = 20) {
  await fetch(`${API}/chat/loading/start`, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify({ chatId, loadingSeconds: Math.min(60, seconds) }),
  }).catch(() => {});
}

export async function getProfile(env, userId) {
  const res = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
    headers: authHeaders(env),
  });
  if (!res.ok) return null;
  return res.json();
}

function authHeaders(env) {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}
