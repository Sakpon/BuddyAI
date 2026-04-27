import {
  askClaude,
  generatePicksViaClaude,
  generatePortfolioAnalysis,
  generatePortfolioRebalance,
} from './claude.js';
import {
  clearHistory,
  clearPortfolios,
  confirmPendingPortfolio,
  deletePendingPortfolio,
  deletePortfolioById,
  getActivePortfolio,
  getHistory,
  getJourney,
  getPendingPortfolio,
  getSubscribedUsers,
  listPortfolios,
  logEvent,
  renamePortfolio,
  savePendingPortfolio,
  saveMessage,
  setActivePortfolio,
  subscribeAlert,
  unsubscribeAlert,
  upsertUser,
} from './db.js';
import { enrollmentCard } from './flex/enrollment.js';
import { dailyAlertCard } from './flex/dailyAlert.js';
import { oilLiffCard, stockLiffCard } from './flex/liffCards.js';
import {
  portfolioAnalysisCard,
  portfolioConfirmCard,
  portfolioListCard,
  portfolioRebalanceCard,
  portfolioSummaryCard,
} from './flex/portfolio.js';
import {
  getProfile,
  push,
  quickReply,
  reply,
  showLoading,
  textMsg,
  verifySignature,
} from './line.js';
import { deleteSession, setSession } from './session.js';
import { extractPortfolio, fetchLineImage } from './vision.js';

const HELP_TH = [
  'คำสั่งที่ใช้ได้:',
  '• ส่งภาพพอร์ตจากแอปโบรกเกอร์ — ระบบจะอ่านและสรุปให้',
  '• "พอร์ต" — ดูพอร์ตที่ใช้งานอยู่',
  '• "พอร์ตทั้งหมด" — รายการพอร์ตทั้งหมด เลือก/ลบได้',
  '• "เปลี่ยนชื่อ <ชื่อใหม่>" — เปลี่ยนชื่อพอร์ตที่ใช้งานอยู่',
  '• "วิเคราะห์พอร์ต" — ขอความเห็นจาก AI',
  '• "ปรับพอร์ต" — ขอข้อเสนอการ rebalance จาก AI',
  '• "ล้างพอร์ต" — ลบพอร์ตทั้งหมด',
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
      if (!authorisedCron(request, env)) return new Response('forbidden', { status: 403 });
      ctx.waitUntil(sendDailyStockAlert(env));
      return json({ ok: true, triggered: 'daily-alert' });
    }

    if (url.pathname === '/test-subs') {
      if (!authorisedCron(request, env)) return new Response('forbidden', { status: 403 });
      const subs = await getSubscribedUsers(env);
      return json({ ok: true, count: subs.length, subs });
    }

    if (url.pathname === '/test-log') {
      if (!authorisedCron(request, env)) return new Response('forbidden', { status: 403 });
      const log = await env.SESSION_KV.get('cron:last-run');
      return json({ ok: true, log: log ? JSON.parse(log) : null });
    }

    if (url.pathname === '/journey') {
      if (!authorisedCron(request, env)) return new Response('forbidden', { status: 403 });
      const targetUserId = url.searchParams.get('userId');
      if (!targetUserId) return json({ ok: false, error: 'userId required' }, 400);
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 100));
      const events = await getJourney(env, targetUserId, limit);
      return json({ ok: true, userId: targetUserId, count: events.length, events });
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
    await logEvent(env, userId, 'unfollow', null);
    return;
  }

  if (ev.type === 'postback') {
    return handlePostback(ev, env, userId);
  }

  if (ev.type === 'message') {
    if (ev.message?.type === 'text') {
      return handleText(ev, env, userId, ev.message.text.trim());
    }
    if (ev.message?.type === 'image') {
      return handleImage(ev, env, userId, ev.message.id);
    }
  }
}

async function handleFollow(ev, env, userId) {
  const profile = await getProfile(env, userId).catch(() => null);
  await upsertUser(env, {
    userId,
    displayName: profile?.displayName || null,
    pictureUrl: profile?.pictureUrl || null,
  });
  await logEvent(env, userId, 'follow', { displayName: profile?.displayName || null });
  await reply(env, ev.replyToken, [
    textMsg(
      `ยินดีต้อนรับสู่ FinBot! ${profile?.displayName || ''}\n` +
      'ส่งภาพหน้าจอพอร์ตของคุณเพื่อเริ่มต้น หรือพิมพ์ /help เพื่อดูคำสั่งทั้งหมด',
    ),
    enrollmentCard(),
  ]);
}

async function handlePostback(ev, env, userId) {
  const data = new URLSearchParams(ev.postback?.data || '');
  const action = data.get('action');

  if (action === 'subscribe') {
    await subscribeAlert(env, userId);
    await logEvent(env, userId, 'subscribe', { via: 'postback' });
    return reply(env, ev.replyToken, textMsg('สมัครการแจ้งเตือนเรียบร้อย รับหุ้นเด่นทุกเช้า 09:00 (จ-ศ)'));
  }
  if (action === 'unsubscribe') {
    await unsubscribeAlert(env, userId);
    await logEvent(env, userId, 'unsubscribe', { via: 'postback' });
    return reply(env, ev.replyToken, textMsg('ยกเลิกการแจ้งเตือนแล้ว'));
  }

  if (action === 'confirm-portfolio') {
    const portfolioId = await confirmPendingPortfolio(env, userId);
    if (!portfolioId) {
      return reply(env, ev.replyToken, textMsg('หมดเวลายืนยัน หรือไม่พบข้อมูลพอร์ตค้างไว้ ลองส่งภาพใหม่อีกครั้งนะครับ'));
    }
    const saved = await getActivePortfolio(env, userId).catch(() => null);
    await logEvent(env, userId, 'portfolio_saved', {
      portfolio_id: portfolioId,
      name: saved?.portfolio?.name || null,
      source: saved?.portfolio?.source || null,
      total_value: saved?.portfolio?.total_value ?? null,
      symbols: (saved?.holdings || []).map((h) => h.symbol),
    });
    return reply(env, ev.replyToken, textMsg(
      `บันทึก "${saved?.portfolio?.name || 'พอร์ต'}" แล้ว — ตั้งเป็นพอร์ตที่ใช้งานปัจจุบัน\n` +
      'พิมพ์ "วิเคราะห์พอร์ต" หรือ "ปรับพอร์ต" เพื่อต่อ\n' +
      'พิมพ์ "เปลี่ยนชื่อ <ชื่อใหม่>" เพื่อตั้งชื่อให้ตรงใจ',
    ));
  }

  if (action === 'retry-portfolio') {
    await deletePendingPortfolio(env, userId);
    await logEvent(env, userId, 'portfolio_retry', null);
    return reply(env, ev.replyToken, textMsg('ยกเลิกแล้ว ส่งภาพพอร์ตอีกครั้งได้เลยครับ'));
  }

  if (action === 'select-portfolio') {
    const id = Number(data.get('id'));
    if (!Number.isFinite(id)) return reply(env, ev.replyToken, textMsg('คำสั่งไม่ถูกต้อง'));
    const ok = await setActivePortfolio(env, userId, id);
    if (!ok) return reply(env, ev.replyToken, textMsg('ไม่พบพอร์ตนั้น อาจถูกลบไปแล้ว'));
    await logEvent(env, userId, 'portfolio_switched', { portfolio_id: id });
    const active = await getActivePortfolio(env, userId);
    return reply(env, ev.replyToken, textMsg(
      `เลือก "${active?.portfolio?.name || 'พอร์ต'}" เป็นพอร์ตที่ใช้งานแล้ว`,
    ));
  }

  if (action === 'delete-portfolio') {
    const id = Number(data.get('id'));
    if (!Number.isFinite(id)) return reply(env, ev.replyToken, textMsg('คำสั่งไม่ถูกต้อง'));
    const ok = await deletePortfolioById(env, userId, id);
    if (!ok) return reply(env, ev.replyToken, textMsg('ไม่พบพอร์ตนั้น'));
    await logEvent(env, userId, 'portfolio_deleted', { portfolio_id: id });
    return reply(env, ev.replyToken, textMsg('ลบพอร์ตแล้ว'));
  }
}

async function handleImage(ev, env, userId, messageId) {
  await showLoading(env, userId, 30);
  await upsertUser(env, { userId });

  let extracted;
  try {
    const { bytes, mimeType } = await fetchLineImage(env, messageId);
    extracted = await extractPortfolio(env, bytes, mimeType);
  } catch (err) {
    console.error('vision error', err);
    await logEvent(env, userId, 'vision_failed', { error: String(err?.message || err).slice(0, 200) });
    return push(env, userId, textMsg('ขออภัยครับ อ่านภาพไม่สำเร็จ ลองส่งใหม่หรือใช้ภาพที่คมชัดกว่านี้ได้ไหมครับ'));
  }

  if (extracted.error === 'not_portfolio') {
    await logEvent(env, userId, 'vision_rejected', { reason: extracted.reason || 'not_portfolio' });
    return push(env, userId, textMsg('ภาพนี้ดูไม่ใช่หน้าจอพอร์ต ลองส่งภาพหน้าจอจากแอปโบรกเกอร์อีกครั้งนะครับ'));
  }

  if (!extracted.holdings || !extracted.holdings.length) {
    await logEvent(env, userId, 'vision_empty', { source: extracted.source || null });
    return push(env, userId, textMsg('อ่านภาพได้แต่ไม่เจอรายการหุ้นเลย ลองส่งภาพที่เห็นรายการหุ้นชัดเจนอีกครั้งนะครับ'));
  }

  await savePendingPortfolio(env, userId, extracted);
  await logEvent(env, userId, 'portfolio_extracted', {
    source: extracted.source || null,
    total_value: extracted.total_value ?? null,
    symbols: (extracted.holdings || []).map((h) => h.symbol),
    warnings: extracted.warnings || [],
  });
  await push(env, userId, [
    textMsg('อ่านพอร์ตจากภาพแล้ว ตรวจสอบความถูกต้องและกดบันทึกเพื่อเริ่มใช้งานได้เลยครับ'),
    portfolioConfirmCard(extracted),
  ]);
}

async function handleText(ev, env, userId, text) {
  const match = matchCommand(text);
  const cmd = match?.cmd;

  if (cmd === 'help') {
    return reply(env, ev.replyToken, textMsg(HELP_TH));
  }
  if (cmd === 'reset') {
    await clearHistory(env, userId);
    await deleteSession(env, userId);
    await logEvent(env, userId, 'reset_chat', null);
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
    await logEvent(env, userId, 'subscribe', { via: 'text' });
    return reply(env, ev.replyToken, textMsg('สมัครการแจ้งเตือนเรียบร้อย รับหุ้นเด่นทุกเช้า 09:00 (จ-ศ)'));
  }
  if (cmd === 'unsubscribe') {
    await unsubscribeAlert(env, userId);
    await logEvent(env, userId, 'unsubscribe', { via: 'text' });
    return reply(env, ev.replyToken, textMsg('ยกเลิกการแจ้งเตือนแล้ว'));
  }
  if (cmd === 'portfolio') {
    return showPortfolio(ev, env, userId);
  }
  if (cmd === 'list-portfolios') {
    const list = await listPortfolios(env, userId);
    return reply(env, ev.replyToken, portfolioListCard(list));
  }
  if (cmd === 'analyse-portfolio') {
    return analysePortfolio(ev, env, userId);
  }
  if (cmd === 'rebalance-portfolio') {
    return rebalancePortfolio(ev, env, userId);
  }
  if (cmd === 'rename-portfolio') {
    const newName = match.arg;
    if (!newName) {
      return reply(env, ev.replyToken, textMsg('พิมพ์ "เปลี่ยนชื่อ <ชื่อใหม่>" ตามด้วยชื่อที่ต้องการ'));
    }
    const active = await getActivePortfolio(env, userId);
    if (!active) {
      return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่ใช้งาน'));
    }
    const oldName = active.portfolio.name;
    const ok = await renamePortfolio(env, userId, active.portfolio.id, newName);
    if (!ok) return reply(env, ev.replyToken, textMsg('ไม่สามารถเปลี่ยนชื่อได้'));
    await logEvent(env, userId, 'portfolio_renamed', {
      portfolio_id: active.portfolio.id,
      from: oldName,
      to: newName.trim().slice(0, 60),
    });
    return reply(env, ev.replyToken, textMsg(`เปลี่ยนชื่อจาก "${oldName}" เป็น "${newName.trim().slice(0, 60)}" แล้ว`));
  }
  if (cmd === 'clear-portfolio') {
    await clearPortfolios(env, userId);
    await logEvent(env, userId, 'portfolio_cleared', null);
    return reply(env, ev.replyToken, textMsg('ลบข้อมูลพอร์ตทั้งหมดแล้ว'));
  }

  await showLoading(env, userId, 20);

  const profile = await getProfile(env, userId).catch(() => null);
  await upsertUser(env, {
    userId,
    displayName: profile?.displayName || null,
    pictureUrl: profile?.pictureUrl || null,
  });

  const history = await getHistory(env, userId, 12);
  const portfolio = await getActivePortfolio(env, userId).catch(() => null);
  const portfolioContext = portfolio
    ? `(บริบท: ผู้ใช้มีพอร์ต — ${portfolio.holdings
        .map((h) => h.symbol)
        .join(', ')} ใช้ข้อมูลนี้ประกอบคำตอบเมื่อเกี่ยวข้อง)`
    : '';
  const messages = [
    ...(portfolioContext ? [{ role: 'user', content: portfolioContext }] : []),
    ...history,
    { role: 'user', content: text },
  ];

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
      { label: 'พอร์ต' },
      { label: 'วิเคราะห์พอร์ต' },
      { label: 'ปรับพอร์ต' },
      { label: '/help' },
    ]),
  ]);
}

async function showPortfolio(ev, env, userId) {
  const active = await getActivePortfolio(env, userId);
  if (!active) {
    return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่บันทึกไว้ ส่งภาพหน้าจอพอร์ตจากแอปโบรกเกอร์ของคุณเพื่อเริ่มต้นได้เลยครับ'));
  }
  return reply(env, ev.replyToken, portfolioSummaryCard(active));
}

async function rebalancePortfolio(ev, env, userId) {
  const active = await getActivePortfolio(env, userId);
  if (!active) {
    return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่บันทึกไว้ ส่งภาพหน้าจอพอร์ตเพื่อเริ่มต้น'));
  }
  await showLoading(env, userId, 30);
  let rebalance;
  try {
    rebalance = await generatePortfolioRebalance(env, active.portfolio, active.holdings);
  } catch (err) {
    console.error('rebalance error', err);
    await logEvent(env, userId, 'portfolio_rebalance_failed', { error: String(err?.message || err).slice(0, 200) });
    return push(env, userId, textMsg('ขออภัยครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ'));
  }

  await logEvent(env, userId, 'portfolio_rebalance', {
    portfolio_id: active.portfolio.id,
    summary: rebalance?.summary || null,
    suggestions: (rebalance?.suggestions || []).map((s) => ({
      symbol: s.symbol,
      action: s.action,
      current_weight_pct: s.current_weight_pct ?? null,
      target_weight_pct: s.target_weight_pct ?? null,
    })),
    diversifiers: (rebalance?.diversifiers || []).map((d) => d.symbol),
  });

  if (rebalance && (rebalance.suggestions?.length || rebalance.diversifiers?.length)) {
    return push(env, userId, portfolioRebalanceCard(rebalance));
  }
  return push(env, userId, textMsg('ขออภัยครับ ระบบประมวลผลข้อเสนอไม่สำเร็จ ลองใหม่อีกครั้งนะครับ'));
}

async function analysePortfolio(ev, env, userId) {
  const active = await getActivePortfolio(env, userId);
  if (!active) {
    return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่บันทึกไว้ ส่งภาพหน้าจอพอร์ตเพื่อเริ่มต้น'));
  }
  await showLoading(env, userId, 25);
  let analysis;
  try {
    analysis = await generatePortfolioAnalysis(env, active.portfolio, active.holdings);
  } catch (err) {
    console.error('analyse error', err);
    await logEvent(env, userId, 'portfolio_analysis_failed', { error: String(err?.message || err).slice(0, 200) });
    return push(env, userId, textMsg('ขออภัยครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ'));
  }

  await logEvent(env, userId, 'portfolio_analysis', {
    portfolio_id: active.portfolio.id,
    verdict: analysis?.verdict || null,
    verdict_reason: analysis?.verdict_reason || null,
    top_symbol: analysis?.metrics?.top_symbol || null,
    top_weight_pct: analysis?.metrics?.top_weight_pct ?? null,
    concentration: analysis?.metrics?.concentration || null,
    sector_count: analysis?.metrics?.sector_count ?? null,
  });

  if (analysis && (analysis.verdict || analysis.metrics || analysis.observations)) {
    return push(env, userId, portfolioAnalysisCard(analysis));
  }
  return push(env, userId, textMsg('ขออภัยครับ ระบบประมวลผลการวิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้งนะครับ'));
}

function matchCommand(text) {
  const t = text.trim();
  const tl = t.toLowerCase();

  if (tl === '/help') return { cmd: 'help' };
  if (tl === '/reset') return { cmd: 'reset' };
  if (['ดูหุ้น', 'หุ้น', 'stock'].includes(tl)) return { cmd: 'stock' };
  if (['ราคาน้ำมัน', 'น้ำมัน', 'oil'].includes(tl)) return { cmd: 'oil' };
  if (tl === 'สมัครการแจ้งเตือน') return { cmd: 'subscribe' };
  if (tl === 'ยกเลิกการแจ้งเตือน') return { cmd: 'unsubscribe' };
  if (['พอร์ต', 'portfolio'].includes(tl)) return { cmd: 'portfolio' };
  if (['พอร์ตทั้งหมด', 'รายการพอร์ต', 'portfolios', 'list portfolios', 'list'].includes(tl))
    return { cmd: 'list-portfolios' };
  if (['วิเคราะห์พอร์ต', 'analyze portfolio', 'analyse portfolio'].includes(tl))
    return { cmd: 'analyse-portfolio' };
  if (['ปรับพอร์ต', 'rebalance', 'rebalance portfolio'].includes(tl))
    return { cmd: 'rebalance-portfolio' };
  if (['ล้างพอร์ต', 'clear portfolio'].includes(tl)) return { cmd: 'clear-portfolio' };

  // Arg-bearing commands.
  for (const prefix of ['เปลี่ยนชื่อ ', 'เปลี่ยนชื่อพอร์ต ', 'rename ']) {
    if (tl.startsWith(prefix.toLowerCase())) {
      return { cmd: 'rename-portfolio', arg: t.slice(prefix.length).trim() };
    }
  }
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

    const date = bangkokDateString();
    let genericPicks = null;

    for (const userId of subs) {
      const active = await getActivePortfolio(env, userId).catch(() => null);
      let picks;
      try {
        picks = active
          ? await generatePicksViaClaude(env, active.holdings)
          : (genericPicks ||= await generatePicksViaClaude(env));
      } catch (err) {
        console.error('picks error', userId, err);
        await logEvent(env, userId, 'daily_alert_failed', {
          stage: 'picks',
          error: String(err?.message || err).slice(0, 200),
        });
        failed++;
        continue;
      }
      const card = dailyAlertCard({
        date,
        picks: picks.picks,
        summary: picks.summary,
      });
      const ok = await push(env, userId, [card]);
      if (ok) {
        success++;
        await logEvent(env, userId, 'daily_alert_sent', {
          date,
          personalised: !!active,
          summary: picks.summary || null,
          picks: (picks.picks || []).map((p) => ({
            symbol: p.symbol,
            signal: p.signal,
          })),
        });
      } else {
        failed++;
        await logEvent(env, userId, 'daily_alert_failed', { stage: 'push' });
      }
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

function authorisedCron(request, env) {
  if (!env.CRON_KEY) return false;
  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${env.CRON_KEY}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
