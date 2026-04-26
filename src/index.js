import { askClaude } from './claude.js';
import {
  clearHistory,
  getHistory,
  getSubscribedUsers,
  saveMessage,
  subscribeAlert,
  unsubscribeAlert,
  upsertUser,
} from './db.js';
import { enrollmentCard } from './flex/enrollment.js';
import { dailyAlertCard } from './flex/dailyAlert.js';
import { oilLiffCard, stockLiffCard } from './flex/liffCards.js';
import {
  getProfile,
  push,
  quickReply,
  reply,
  showLoading,
  textMsg,
  verifySignature,
} from './line.js';
import { deleteSession, getSession, setSession } from './session.js';

const HELP_TH = [
  'คำสั่งที่ใช้ได้:',
  '• "ดูหุ้น" — เปิด Stock Dashboard',
  '• "ราคาน้ำมัน" — ดูราคาน้ำมันวันนี้',
  '• "สมัครการแจ้งเตือน" — รับหุ้นเด่นทุก 09:00',
  '• "ยกเลิกการแจ้งเตือน"',
  '• "/reset" — ล้างประวัติแชท',
  '• "/help" — เมนูช่วยเหลือ',
].join('\n');

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, ts: Date.now() });
    }

    if (url.pathname === '/callback' && request.method === 'POST') {
      return handleWebhook(request, env, ctx);
    }

    if (url.pathname === '/test-alert') {
      ctx.waitUntil(sendDailyStockAlert(env));
      return json({ ok: true, triggered: 'daily-alert' });
    }

    if (url.pathname === '/test-subs') {
      const subs = await getSubscribedUsers(env);
      return json({ ok: true, count: subs.length, subs });
    }

    if (url.pathname === '/test-log') {
      const log = await env.SESSION_KV.get('cron:last-run');
      return json({ ok: true, log: log ? JSON.parse(log) : null });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDailyStockAlert(env));
  },
};

async function handleWebhook(request, env, ctx) {
  const raw = await request.text();
  const sigOk = await verifySignature(
    env.LINE_CHANNEL_SECRET,
    request.headers.get('x-line-signature'),
    raw,
  );
  if (!sigOk) return new Response('bad signature', { status: 401 });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  for (const ev of body.events || []) {
    ctx.waitUntil(handleEvent(ev, env).catch((err) => console.error('event error', err)));
  }
  return new Response('OK');
}

async function handleEvent(ev, env) {
  const userId = ev.source?.userId;
  if (!userId) return;

  if (ev.type === 'follow') {
    return handleFollow(ev, env, userId);
  }

  if (ev.type === 'unfollow') {
    await unsubscribeAlert(env, userId);
    await deleteSession(env, userId);
    return;
  }

  if (ev.type === 'postback') {
    return handlePostback(ev, env, userId);
  }

  if (ev.type === 'message' && ev.message?.type === 'text') {
    return handleText(ev, env, userId, ev.message.text.trim());
  }
}

async function handleFollow(ev, env, userId) {
  const profile = await getProfile(env, userId).catch(() => null);
  await upsertUser(env, {
    userId,
    displayName: profile?.displayName || null,
    pictureUrl: profile?.pictureUrl || null,
  });
  await reply(env, ev.replyToken, [
    textMsg(`ยินดีต้อนรับสู่ FinBot! ${profile?.displayName || ''}\nพิมพ์ /help เพื่อดูคำสั่งทั้งหมด`),
    enrollmentCard(),
  ]);
}

async function handlePostback(ev, env, userId) {
  const data = new URLSearchParams(ev.postback?.data || '');
  const action = data.get('action');
  if (action === 'subscribe') {
    await subscribeAlert(env, userId);
    return reply(env, ev.replyToken, textMsg('สมัครการแจ้งเตือนเรียบร้อย รับหุ้นเด่นทุกเช้า 09:00 (จ-ศ)'));
  }
  if (action === 'unsubscribe') {
    await unsubscribeAlert(env, userId);
    return reply(env, ev.replyToken, textMsg('ยกเลิกการแจ้งเตือนแล้ว'));
  }
}

async function handleText(ev, env, userId, text) {
  const cmd = matchCommand(text);

  if (cmd === 'help') {
    return reply(env, ev.replyToken, textMsg(HELP_TH));
  }
  if (cmd === 'reset') {
    await clearHistory(env, userId);
    await deleteSession(env, userId);
    return reply(env, ev.replyToken, textMsg('ล้างประวัติแชทแล้ว เริ่มใหม่ได้เลย'));
  }
  if (cmd === 'stock') {
    return reply(env, ev.replyToken, stockLiffCard(env));
  }
  if (cmd === 'oil') {
    return reply(env, ev.replyToken, oilLiffCard(env));
  }
  if (cmd === 'subscribe') {
    await upsertUser(env, { userId });
    await subscribeAlert(env, userId);
    return reply(env, ev.replyToken, textMsg('สมัครการแจ้งเตือนเรียบร้อย รับหุ้นเด่นทุกเช้า 09:00 (จ-ศ)'));
  }
  if (cmd === 'unsubscribe') {
    await unsubscribeAlert(env, userId);
    return reply(env, ev.replyToken, textMsg('ยกเลิกการแจ้งเตือนแล้ว'));
  }

  await showLoading(env, userId, 20);

  const profile = await getProfile(env, userId).catch(() => null);
  await upsertUser(env, {
    userId,
    displayName: profile?.displayName || null,
    pictureUrl: profile?.pictureUrl || null,
  });

  const history = await getHistory(env, userId, 12);
  const messages = [...history, { role: 'user', content: text }];

  let answer;
  try {
    answer = await askClaude(messages, env);
  } catch (err) {
    console.error('claude error', err);
    answer = 'ขออภัยครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ';
  }

  await Promise.all([
    saveMessage(env, userId, 'user', text),
    saveMessage(env, userId, 'assistant', answer),
    setSession(env, userId, { lastTurn: Date.now() }),
  ]);

  await push(env, userId, [
    textMsg(answer),
    quickReply('ทำต่อได้เลยครับ', [
      { label: 'ดูหุ้น' },
      { label: 'ราคาน้ำมัน' },
      { label: '/help' },
    ]),
  ]);
}

function matchCommand(text) {
  const t = text.toLowerCase();
  if (t === '/help') return 'help';
  if (t === '/reset') return 'reset';
  if (['ดูหุ้น', 'หุ้น', 'stock'].includes(t)) return 'stock';
  if (['ราคาน้ำมัน', 'น้ำมัน', 'oil'].includes(t)) return 'oil';
  if (t === 'สมัครการแจ้งเตือน') return 'subscribe';
  if (t === 'ยกเลิกการแจ้งเตือน') return 'unsubscribe';
  return null;
}

async function sendDailyStockAlert(env) {
  const startedAt = new Date().toISOString();
  let success = 0;
  let failed = 0;
  let error = null;

  try {
    const subs = await getSubscribedUsers(env);
    if (!subs.length) {
      await env.SESSION_KV.put(
        'cron:last-run',
        JSON.stringify({ startedAt, subs: 0, success, failed }),
        { expirationTtl: 60 * 60 * 24 * 7 },
      );
      return;
    }

    const picks = await generatePicksViaClaude(env);
    const card = dailyAlertCard({
      date: bangkokDateString(),
      picks: picks.picks,
      summary: picks.summary,
    });

    for (const userId of subs) {
      const ok = await push(env, userId, [card]);
      if (ok) success++;
      else failed++;
    }
  } catch (err) {
    error = String(err?.message || err);
    console.error('cron error', err);
  } finally {
    await env.SESSION_KV.put(
      'cron:last-run',
      JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), success, failed, error }),
      { expirationTtl: 60 * 60 * 24 * 7 },
    );
  }
}

async function generatePicksViaClaude(env) {
  const prompt = [
    {
      role: 'user',
      content:
        'ขอสรุปหุ้นไทยน่าจับตา 3-5 ตัวสำหรับวันนี้ ในรูปแบบ JSON เท่านั้น\n' +
        '{ "summary": "สั้นๆ 1 ประโยค", "picks": [ { "symbol": "XXX", "signal": "Watch|Buy|Sell|Neutral", "reason": "เหตุผลสั้น" } ] }\n' +
        'อ้างอิงข้อมูลพื้นฐาน/ปัจจัยเชิงมหภาคที่ทราบได้ทั่วไป โดยไม่ใช้ราคาแบบเรียลไทม์',
    },
  ];
  const raw = await askClaude(prompt, env);
  return parseJsonLoose(raw) || { summary: raw.slice(0, 200), picks: [] };
}

function parseJsonLoose(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function bangkokDateString() {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'long',
  }).format(new Date());
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
