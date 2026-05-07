import {
  askClaude,
  generateDailyNewsForHoldings,
  generateHoldingsStatus,
  generatePicksViaClaude,
  generatePortfolioAnalysis,
  generatePortfolioComparison,
  generatePortfolioRebalance,
} from './claude.js';
import {
  applyPendingTransactions,
  clearHistory,
  clearPortfolios,
  confirmPendingPortfolio,
  deletePendingPortfolio,
  deletePendingTransactions,
  deletePortfolioById,
  getActivePortfolio,
  getHistory,
  getJourney,
  getNewsSubscribedUsers,
  getPendingPortfolio,
  getPortfolioSnapshots,
  getPortfolioWithHoldings,
  getSubscribedUsers,
  listPortfolios,
  listTransactions,
  logEvent,
  recordBuy,
  recordSell,
  renamePortfolio,
  savePendingPortfolio,
  savePendingTransactions,
  saveMessage,
  setActivePortfolio,
  updatePortfolioFromPending,
  subscribeAlert,
  subscribeNews,
  unsubscribeAlert,
  unsubscribeNews,
  upsertUser,
} from './db.js';
import { enrollmentCard } from './flex/enrollment.js';
import { dailyAlertCard } from './flex/dailyAlert.js';
import { dailyNewsCard } from './flex/news.js';
import { oilLiffCard, stockLiffCard } from './flex/liffCards.js';
import {
  holdingsStatusCard,
  portfolioAnalysisCard,
  portfolioCompareCard,
  portfolioConfirmCard,
  portfolioListCard,
  portfolioRebalanceCard,
  portfolioSummaryCard,
  transactionConfirmCard,
  transactionsImportConfirmCard,
  transactionsImportResultCard,
  transactionsListCard,
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
import { extractFromImage, fetchLineImage } from './vision.js';
import { fetchYahooNewsForHoldings } from './news.js';
import { fetchUnifiedQuotesForHoldings } from './marketdata.js';
import { adminPage } from './admin/page.js';
import {
  adminApiCronLogs,
  adminApiJourney,
  adminApiOverview,
  adminApiPortfolios,
  adminApiUsers,
} from './admin/handlers.js';

const HELP_TH = [
  'คำสั่งที่ใช้ได้:',
  '• ส่งภาพพอร์ตจากแอปโบรกเกอร์ — ระบบจะอ่านและสรุปให้',
  '• ส่งภาพรายการซื้อขาย (เช่น SCB Easy Activity) — ระบบจะอ่านและให้กดยืนยันนำเข้า',
  '• "พอร์ต" — ดูพอร์ตที่ใช้งานอยู่',
  '• "พอร์ตทั้งหมด" — รายการพอร์ตทั้งหมด เลือก/ลบได้',
  '• "เปลี่ยนชื่อ <ชื่อใหม่>" — เปลี่ยนชื่อพอร์ตที่ใช้งานอยู่',
  '• "สถานะหุ้น" — ราคาล่าสุด + คำแนะนำรายตัว',
  '• "ซื้อ <SYMBOL> <จำนวน> @ <ราคา>" — บันทึกการซื้อหุ้น (เช่น ซื้อ PTT 100 @ 35.50)',
  '• "ขาย <SYMBOL> <จำนวน> @ <ราคา>" — บันทึกการขายหุ้น',
  '• "รายการซื้อขาย" — ดูประวัติการซื้อขายของพอร์ต',
  '• "วิเคราะห์พอร์ต" — ขอความเห็นจาก AI',
  '• "ปรับพอร์ต" — ขอข้อเสนอการ rebalance จาก AI',
  '• "เปรียบเทียบพอร์ต" — เทียบพอร์ตที่ใช้งานกับอันก่อนหน้า',
  '• "ประวัติพอร์ต" — ดูประวัติการอัพเดตของพอร์ตที่ใช้งาน',
  '• "ล้างพอร์ต" — ลบพอร์ตทั้งหมด',
  '• "ดูหุ้น" — เปิด Stock Dashboard',
  '• "ราคาน้ำมัน" — ดูราคาน้ำมันวันนี้',
  '• "สมัครการแจ้งเตือน" — รับหุ้นเด่นทุก 09:00',
  '• "ยกเลิกการแจ้งเตือน"',
  '• "สมัครข่าว" — รับข่าวพอร์ตทุกเช้า 08:00',
  '• "ยกเลิกข่าว"',
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
      if (!authorised(request, env)) return unauthorised(false);
      ctx.waitUntil(sendDailyStockAlert(env));
      return json({ ok: true, triggered: 'daily-alert' });
    }

    if (url.pathname === '/test-news') {
      if (!authorised(request, env)) return unauthorised(false);
      ctx.waitUntil(sendDailyNews(env));
      return json({ ok: true, triggered: 'daily-news' });
    }

    if (url.pathname === '/test-subs') {
      if (!authorised(request, env)) return unauthorised(false);
      const subs = await getSubscribedUsers(env);
      return json({ ok: true, count: subs.length, subs });
    }

    if (url.pathname === '/test-log') {
      if (!authorised(request, env)) return unauthorised(false);
      const [alertLog, newsLog] = await Promise.all([
        env.SESSION_KV.get('cron:last-run'),
        env.SESSION_KV.get('news:last-run'),
      ]);
      return json({
        ok: true,
        alert: alertLog ? JSON.parse(alertLog) : null,
        news: newsLog ? JSON.parse(newsLog) : null,
      });
    }

    if (url.pathname === '/journey') {
      if (!authorised(request, env)) return unauthorised(false);
      const targetUserId = url.searchParams.get('userId');
      if (!targetUserId) return json({ ok: false, error: 'userId required' }, 400);
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 100));
      const events = await getJourney(env, targetUserId, limit);
      return json({ ok: true, userId: targetUserId, count: events.length, events });
    }

    // Admin portal — entire /admin tree is gated. Browser-friendly 401 with
    // WWW-Authenticate so Safari/Chrome show their native user/pass prompt
    // and cache the credentials for subsequent /admin/api/* calls.
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      if (!authorised(request, env)) return unauthorised(true);
      return new Response(adminPage(), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (url.pathname.startsWith('/admin/api/')) {
      if (!authorised(request, env)) return unauthorised(true);
      if (url.pathname === '/admin/api/overview')   return adminApiOverview(env);
      if (url.pathname === '/admin/api/users')      return adminApiUsers(env);
      if (url.pathname === '/admin/api/portfolios') return adminApiPortfolios(env);
      if (url.pathname === '/admin/api/journey')    return adminApiJourney(env, url);
      if (url.pathname === '/admin/api/cron-logs')  return adminApiCronLogs(env);
      return json({ ok: false, error: 'admin route not found' }, 404);
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

  if (action === 'update-portfolio') {
    const id = Number(data.get('id'));
    if (!Number.isFinite(id)) return reply(env, ev.replyToken, textMsg('คำสั่งไม่ถูกต้อง'));
    const result = await updatePortfolioFromPending(env, userId, id);
    if (!result) {
      return reply(env, ev.replyToken, textMsg('ไม่พบพอร์ตหรือหมดเวลายืนยัน ส่งภาพพอร์ตใหม่อีกครั้งนะครับ'));
    }
    const updated = await getPortfolioWithHoldings(env, userId, id);
    await logEvent(env, userId, 'portfolio_updated', {
      portfolio_id: id,
      snapshot_id: result.snapshotId,
      name: updated?.portfolio?.name || null,
      total_value: updated?.portfolio?.total_value ?? null,
      symbols: (updated?.holdings || []).map((h) => h.symbol),
    });
    return reply(env, ev.replyToken, textMsg(
      `อัพเดต "${updated?.portfolio?.name || 'พอร์ต'}" เรียบร้อย — เก็บ snapshot เดิมไว้ในประวัติแล้ว\n` +
      'พิมพ์ "ประวัติพอร์ต" เพื่อดูการเปลี่ยนแปลง',
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

  if (action === 'list-transactions') {
    return showTransactions(ev, env, userId);
  }

  if (action === 'confirm-transactions-import') {
    const active = await getActivePortfolio(env, userId);
    if (!active) {
      return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่ใช้งาน — ส่งภาพพอร์ตเพื่อเริ่มต้นก่อนนำเข้ารายการซื้อขาย'));
    }
    const result = await applyPendingTransactions(env, userId, active.portfolio.id);
    if (!result) {
      return reply(env, ev.replyToken, textMsg('หมดเวลายืนยัน หรือไม่มีข้อมูลรายการค้างไว้ ส่งภาพใหม่อีกครั้งนะครับ'));
    }
    await logEvent(env, userId, 'transactions_imported', {
      portfolio_id: active.portfolio.id,
      applied: result.applied.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
      error_reasons: result.errors.map((e) => e.error),
    });
    return reply(env, ev.replyToken, transactionsImportResultCard({
      portfolioName: active.portfolio.name || null,
      applied: result.applied,
      skipped: result.skipped,
      errors: result.errors,
    }));
  }

  if (action === 'retry-transactions-import') {
    await deletePendingTransactions(env, userId);
    await logEvent(env, userId, 'transactions_import_cancelled', null);
    return reply(env, ev.replyToken, textMsg('ยกเลิกการนำเข้ารายการซื้อขายแล้ว'));
  }
}

async function handleImage(ev, env, userId, messageId) {
  await showLoading(env, userId, 30);
  await upsertUser(env, { userId });

  let extracted;
  try {
    const { bytes, mimeType } = await fetchLineImage(env, messageId);
    extracted = await extractFromImage(env, bytes, mimeType);
  } catch (err) {
    console.error('vision error', err);
    await logEvent(env, userId, 'vision_failed', { error: String(err?.message || err).slice(0, 200) });
    return push(env, userId, textMsg('ขออภัยครับ อ่านภาพไม่สำเร็จ ลองส่งใหม่หรือใช้ภาพที่คมชัดกว่านี้ได้ไหมครับ'));
  }

  if (extracted.kind === 'transactions') {
    return handleTransactionImage(ev, env, userId, extracted);
  }

  if (extracted.kind !== 'portfolio') {
    await logEvent(env, userId, 'vision_rejected', { reason: extracted.reason || extracted.kind || 'unknown' });
    return push(env, userId, textMsg(
      'ภาพนี้ดูไม่ใช่หน้าจอพอร์ตหรือรายการซื้อขาย ลองส่งภาพหน้าจอจากแอปโบรกเกอร์/แอปธนาคารอีกครั้งนะครับ',
    ));
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
  const active = await getActivePortfolio(env, userId).catch(() => null);
  await push(env, userId, [
    textMsg('อ่านพอร์ตจากภาพแล้ว ตรวจสอบความถูกต้องและกดบันทึกเพื่อเริ่มใช้งานได้เลยครับ'),
    portfolioConfirmCard(extracted, active?.portfolio || null),
  ]);
}

async function handleTransactionImage(ev, env, userId, extracted) {
  const all = Array.isArray(extracted.transactions) ? extracted.transactions : [];
  const importable = all.filter(
    (t) => t.status !== 'processing' && t.quantity != null && t.price != null && t.symbol,
  );

  if (!importable.length) {
    await logEvent(env, userId, 'transactions_extracted_empty', {
      source: extracted.source || null,
      total: all.length,
    });
    return push(env, userId, textMsg(
      'อ่านภาพได้ว่าเป็นรายการซื้อขาย แต่ยังไม่มีรายการที่ข้อมูลครบ (ต้องเห็นทั้งจำนวนหน่วยและราคา/NAV) ลองส่งภาพที่เห็นรายการ Done ชัดเจนอีกครั้งนะครับ',
    ));
  }

  const active = await getActivePortfolio(env, userId).catch(() => null);
  await savePendingTransactions(env, userId, extracted);
  // Log the full extracted rows so the admin journey view can show exactly
  // what Claude returned — invaluable when "the bot missed a transaction"
  // turns into "did Claude not see it, or did the importable filter drop it?".
  await logEvent(env, userId, 'transactions_extracted', {
    source: extracted.source || null,
    importable_count: importable.length,
    total_count: all.length,
    symbols: [...new Set(importable.map((t) => String(t.symbol).toUpperCase()))],
    warnings: extracted.warnings || [],
    rows: all.map((t) => ({
      side: t.side,
      symbol: t.symbol,
      quantity: t.quantity ?? null,
      price: t.price ?? null,
      executed_at: t.executed_at || null,
      status: t.status || null,
    })),
  });

  return push(env, userId, [
    textMsg(
      active
        ? 'อ่านรายการซื้อขายจากภาพแล้ว ตรวจสอบและกด "บันทึกทั้งหมด" เพื่อเพิ่มเข้าพอร์ตของคุณ'
        : 'อ่านรายการซื้อขายจากภาพแล้ว แต่คุณยังไม่มีพอร์ตที่ใช้งาน — ส่งภาพพอร์ตก่อน แล้วส่งภาพรายการซื้อขายอีกครั้งครับ',
    ),
    transactionsImportConfirmCard({
      extracted,
      portfolioName: active?.portfolio?.name || null,
    }),
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
  if (cmd === 'subscribe-news') {
    await upsertUser(env, { userId });
    await subscribeNews(env, userId);
    await logEvent(env, userId, 'subscribe_news', { via: 'text' });
    return reply(env, ev.replyToken, textMsg('สมัครข่าวประจำวันเรียบร้อย รับข่าวสำหรับพอร์ตของคุณทุกเช้า 08:00 (จ-ศ)'));
  }
  if (cmd === 'unsubscribe-news') {
    await unsubscribeNews(env, userId);
    await logEvent(env, userId, 'unsubscribe_news', { via: 'text' });
    return reply(env, ev.replyToken, textMsg('ยกเลิกข่าวประจำวันแล้ว'));
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
  if (cmd === 'compare-portfolios') {
    return comparePortfolios(ev, env, userId);
  }
  if (cmd === 'portfolio-history') {
    return showPortfolioHistory(ev, env, userId);
  }
  if (cmd === 'holdings-status') {
    return showHoldingsStatus(ev, env, userId);
  }
  if (cmd === 'transaction') {
    return recordTransaction(ev, env, userId, match.arg);
  }
  if (cmd === 'list-transactions') {
    return showTransactions(ev, env, userId);
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
      { label: 'สถานะหุ้น' },
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

async function recordTransaction(ev, env, userId, arg) {
  const active = await getActivePortfolio(env, userId);
  if (!active) {
    return reply(env, ev.replyToken, textMsg(
      'ยังไม่มีพอร์ตที่ใช้งาน ต้องบันทึกพอร์ตก่อนจึงจะเพิ่มรายการซื้อขายได้ — ส่งภาพพอร์ตเพื่อเริ่มต้น',
    ));
  }

  const { side, symbol, quantity, price } = arg;
  const fn = side === 'BUY' ? recordBuy : recordSell;
  const result = await fn(env, userId, active.portfolio.id, { symbol, quantity, price });

  if (!result?.ok) {
    const err = result?.error;
    let msg;
    if (err === 'no_position') {
      msg = `ไม่พบ ${symbol} ในพอร์ต "${active.portfolio.name}" — ยังไม่ได้ถือหุ้นตัวนี้`;
    } else if (err === 'insufficient_quantity') {
      msg = `ขาย ${symbol} ได้สูงสุด ${result.held} หุ้น (ต้องการ ${quantity})`;
    } else if (err === 'invalid_input') {
      msg = 'ข้อมูลไม่ถูกต้อง ลองอีกครั้ง เช่น "ซื้อ PTT 100 @ 35.50"';
    } else {
      msg = 'บันทึกรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ';
    }
    await logEvent(env, userId, 'transaction_failed', {
      portfolio_id: active.portfolio.id,
      side, symbol, quantity, price,
      error: err || 'unknown',
    });
    return reply(env, ev.replyToken, textMsg(msg));
  }

  await logEvent(env, userId, side === 'BUY' ? 'transaction_buy' : 'transaction_sell', {
    portfolio_id: active.portfolio.id,
    tx_id: result.txId,
    symbol: result.symbol,
    quantity: result.quantity,
    price: result.price,
    fees: result.fees,
    realized_pl: result.realized_pl ?? null,
    new_quantity: result.position?.quantity ?? null,
    new_avg_cost: result.position?.avg_cost ?? null,
  });

  return reply(env, ev.replyToken, transactionConfirmCard({
    result,
    portfolioName: active.portfolio.name || null,
  }));
}

async function showTransactions(ev, env, userId) {
  const active = await getActivePortfolio(env, userId);
  if (!active) {
    return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่ใช้งาน — ส่งภาพพอร์ตเพื่อเริ่มต้น'));
  }
  const transactions = await listTransactions(env, userId, active.portfolio.id, 50);
  return reply(env, ev.replyToken, transactionsListCard({
    portfolioName: active.portfolio.name || null,
    transactions,
  }));
}

async function showHoldingsStatus(ev, env, userId) {
  const active = await getActivePortfolio(env, userId);
  if (!active || !active.holdings.length) {
    return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่ใช้งาน หรือไม่มีหุ้นในพอร์ต — ส่งภาพพอร์ตเพื่อเริ่มต้น'));
  }
  await showLoading(env, userId, 25);

  // Per-market routing with fallbacks (see src/marketdata.js):
  //   US -> Finnhub -> Stooq
  //   HK -> Sina    -> Stooq
  //   SET-> set.or.th -> Stooq
  const quotes = await fetchUnifiedQuotesForHoldings(env, active.holdings).catch(() => ({}));
  const sources = {};
  for (const sym of Object.keys(quotes)) sources[sym] = quotes[sym]?.source || null;

  // Build the per-symbol context that goes to Claude.
  const items = active.holdings.map((h) => {
    const q = quotes[h.symbol];
    const price = q?.regular_market_price ?? null;
    const day_change_pct = q?.regular_market_change_pct ?? null;
    let pl_pct = null;
    if (price != null && h.avg_cost != null && h.avg_cost > 0) {
      pl_pct = ((price - h.avg_cost) / h.avg_cost) * 100;
    }
    let distance_from_52w_high_pct = null;
    if (price != null && q?.fifty_two_week_high != null && q.fifty_two_week_high > 0) {
      distance_from_52w_high_pct = ((price - q.fifty_two_week_high) / q.fifty_two_week_high) * 100;
    }
    return {
      symbol: h.symbol,
      current_price: price,
      day_change_pct,
      pl_pct,
      distance_from_52w_high_pct,
      weight_pct: h.weight_pct ?? null,
      has_quote: !!q,
      source: sources[h.symbol] || null,
    };
  });

  let aiResp;
  try {
    aiResp = await generateHoldingsStatus(env, items);
  } catch (err) {
    console.error('status error', err);
    await logEvent(env, userId, 'holdings_status_failed', { error: String(err?.message || err).slice(0, 200) });
    return push(env, userId, textMsg('ขออภัยครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ'));
  }

  // Merge AI's action+rationale into the price-bearing items keyed by symbol.
  const aiBySymbol = {};
  for (const it of (aiResp?.items || [])) {
    if (!it || !it.symbol) continue;
    aiBySymbol[String(it.symbol).toUpperCase()] = it;
  }
  const merged = items.map((it) => {
    const ai = aiBySymbol[it.symbol.toUpperCase()] || {};
    return {
      ...it,
      action: ai.action || (it.has_quote ? 'Hold' : 'Watch'),
      rationale: ai.rationale || null,
    };
  });

  const realQuoteCount = items.filter((i) => i.has_quote).length;
  const sourceCounts = items.reduce(
    (acc, i) => {
      const k = i.source || 'none';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    },
    {},
  );
  await logEvent(env, userId, 'holdings_status_requested', {
    portfolio_id: active.portfolio.id,
    real_quote_count: realQuoteCount,
    quote_sources: sourceCounts,
    items: merged.map((m) => ({
      symbol: m.symbol,
      action: m.action,
      day_change_pct: m.day_change_pct,
      pl_pct: m.pl_pct,
      source: m.source || null,
    })),
  });

  const asOf = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  return push(env, userId, holdingsStatusCard({
    portfolioName: active.portfolio.name || null,
    items: merged,
    asOf,
  }));
}

async function showPortfolioHistory(ev, env, userId) {
  const active = await getActivePortfolio(env, userId);
  if (!active) {
    return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่ใช้งาน — ส่งภาพพอร์ตเพื่อเริ่มต้น'));
  }
  const snapshots = await getPortfolioSnapshots(env, userId, active.portfolio.id, 20);
  if (!snapshots.length) {
    return reply(env, ev.replyToken, textMsg(
      `"${active.portfolio.name}" ยังไม่มีประวัติการอัพเดต\nครั้งต่อไปที่ส่งภาพ ให้กด "อัพเดต" เพื่อเก็บ snapshot ไว้ดูย้อนหลังได้`,
    ));
  }

  const lines = [`ประวัติของ "${active.portfolio.name}"`, ''];
  // Current state at the top.
  lines.push(`• ${formatTakenAt(active.portfolio.taken_at)} (ปัจจุบัน) — ${formatMoney(active.portfolio.total_value)}`);
  for (const s of snapshots) {
    lines.push(`• ${formatTakenAt(s.taken_at)} — ${formatMoney(s.total_value)} (${(s.holdings || []).length} ตัว)`);
  }
  return reply(env, ev.replyToken, textMsg(lines.join('\n')));
}

function formatTakenAt(unix) {
  if (!unix) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unix * 1000));
}

function formatMoney(n) {
  if (n == null) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

async function comparePortfolios(ev, env, userId) {
  const all = await listPortfolios(env, userId);
  if (all.length < 2) {
    return reply(env, ev.replyToken, textMsg('ต้องมีพอร์ตอย่างน้อย 2 รายการเพื่อเปรียบเทียบ ส่งภาพพอร์ตอีกอันเพื่อเริ่มต้น'));
  }
  // Compare active vs the most recent inactive.
  const activeMeta = all.find((p) => p.is_active === 1) || all[0];
  const otherMeta = all.find((p) => p.id !== activeMeta.id);
  if (!otherMeta) {
    return reply(env, ev.replyToken, textMsg('ต้องมีพอร์ตอย่างน้อย 2 รายการเพื่อเปรียบเทียบ'));
  }

  await showLoading(env, userId, 25);
  const [a, b] = await Promise.all([
    getPortfolioWithHoldings(env, userId, activeMeta.id),
    getPortfolioWithHoldings(env, userId, otherMeta.id),
  ]);
  if (!a || !b) {
    return push(env, userId, textMsg('ขออภัย ดึงข้อมูลพอร์ตไม่สำเร็จ ลองใหม่อีกครั้งนะครับ'));
  }

  let comparison;
  try {
    comparison = await generatePortfolioComparison(env, a, b);
  } catch (err) {
    console.error('compare error', err);
    await logEvent(env, userId, 'portfolio_compare_failed', { error: String(err?.message || err).slice(0, 200) });
    return push(env, userId, textMsg('ขออภัยครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ'));
  }

  await logEvent(env, userId, 'portfolio_compared', {
    a_id: a.portfolio.id,
    a_name: a.portfolio.name,
    b_id: b.portfolio.id,
    b_name: b.portfolio.name,
    summary: comparison?.summary || null,
    only_in_a: comparison?.only_in_a || [],
    only_in_b: comparison?.only_in_b || [],
  });

  if (comparison && (comparison.summary || comparison.only_in_a?.length || comparison.only_in_b?.length || comparison.common?.length)) {
    return push(env, userId, portfolioCompareCard({ a, b, comparison }));
  }
  return push(env, userId, textMsg('ขออภัยครับ ระบบประมวลผลการเปรียบเทียบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ'));
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
  if (['สมัครข่าว', 'subscribe news'].includes(tl)) return { cmd: 'subscribe-news' };
  if (['ยกเลิกข่าว', 'unsubscribe news'].includes(tl)) return { cmd: 'unsubscribe-news' };
  if (['พอร์ต', 'portfolio'].includes(tl)) return { cmd: 'portfolio' };
  if (['พอร์ตทั้งหมด', 'รายการพอร์ต', 'portfolios', 'list portfolios', 'list'].includes(tl))
    return { cmd: 'list-portfolios' };
  if (['วิเคราะห์พอร์ต', 'analyze portfolio', 'analyse portfolio'].includes(tl))
    return { cmd: 'analyse-portfolio' };
  if (['ปรับพอร์ต', 'rebalance', 'rebalance portfolio'].includes(tl))
    return { cmd: 'rebalance-portfolio' };
  if (['เปรียบเทียบพอร์ต', 'เทียบพอร์ต', 'compare', 'compare portfolios'].includes(tl))
    return { cmd: 'compare-portfolios' };
  if (['ประวัติพอร์ต', 'ประวัติ', 'history', 'portfolio history'].includes(tl))
    return { cmd: 'portfolio-history' };
  if (['สถานะหุ้น', 'สถานะ', 'status', 'holdings status'].includes(tl))
    return { cmd: 'holdings-status' };
  if (['ล้างพอร์ต', 'clear portfolio'].includes(tl)) return { cmd: 'clear-portfolio' };
  if (['รายการซื้อขาย', 'ประวัติซื้อขาย', 'transactions', 'tx'].includes(tl))
    return { cmd: 'list-transactions' };

  // Buy / sell — accept Thai or English verb, optional "@" before price,
  // optional commas in numbers. Examples that all match:
  //   ซื้อ PTT 100 @ 35.50
  //   ขาย AAPL 5 180
  //   buy 0700.HK 200 @ 320
  const tx = t.match(
    /^(ซื้อ|ขาย|buy|sell)\s+([A-Za-z0-9.\-]+)\s+([\d,]+(?:\.\d+)?)\s*@?\s*([\d,]+(?:\.\d+)?)$/i,
  );
  if (tx) {
    const verb = tx[1].toLowerCase();
    const side = (verb === 'ซื้อ' || verb === 'buy') ? 'BUY' : 'SELL';
    return {
      cmd: 'transaction',
      arg: {
        side,
        symbol: tx[2].toUpperCase(),
        quantity: Number(tx[3].replace(/,/g, '')),
        price: Number(tx[4].replace(/,/g, '')),
      },
    };
  }

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

async function sendDailyNews(env) {
  const startedAt = new Date().toISOString();
  let success = 0;
  let failed = 0;
  let error = null;

  try {
    const subs = await getNewsSubscribedUsers(env);
    if (!subs.length) {
      await env.SESSION_KV.put(
        'news:last-run',
        JSON.stringify({ startedAt, subs: 0, success, failed }),
        { expirationTtl: 60 * 60 * 24 * 7 },
      );
      return;
    }

    const date = bangkokDateString();

    for (const userId of subs) {
      const active = await getActivePortfolio(env, userId).catch(() => null);
      if (!active || !active.holdings?.length) {
        // Subscribed users without an active portfolio get nothing today —
        // news is per-portfolio. They keep getting the daily-alert pick set.
        continue;
      }

      const headlines = await fetchYahooNewsForHoldings(active.holdings).catch(() => ({}));
      const realHeadlineCount = Object.values(headlines).reduce((n, arr) => n + (arr?.length || 0), 0);

      let news;
      try {
        news = await generateDailyNewsForHoldings(env, active.holdings, headlines);
      } catch (err) {
        console.error('news error', userId, err);
        await logEvent(env, userId, 'daily_news_failed', {
          stage: 'generate',
          error: String(err?.message || err).slice(0, 200),
        });
        failed++;
        continue;
      }

      if (!news || !Array.isArray(news.items) || !news.items.length) {
        await logEvent(env, userId, 'daily_news_empty', { portfolio_id: active.portfolio.id });
        continue;
      }

      const card = dailyNewsCard({
        date,
        news,
        portfolioName: active.portfolio.name || null,
      });
      const ok = await push(env, userId, [card]);
      if (ok) {
        success++;
        await logEvent(env, userId, 'daily_news_sent', {
          date,
          portfolio_id: active.portfolio.id,
          summary: news.summary || null,
          real_headline_count: realHeadlineCount,
          items: (news.items || []).map((it) => ({
            symbol: it.symbol,
            action: it.action,
            headline: it.headline,
            from_real_headline: !!it.from_real_headline,
          })),
        });
      } else {
        failed++;
        await logEvent(env, userId, 'daily_news_failed', { stage: 'push' });
      }
    }
  } catch (err) {
    error = String(err?.message || err);
    console.error('news cron error', err);
  } finally {
    await env.SESSION_KV.put(
      'news:last-run',
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

// Accepts EITHER:
//   - Bearer <CRON_KEY>                       (cron workflows, curl scripts)
//   - Basic base64(<ADMIN_USER>:<ADMIN_PASS>) (browser admin portal)
// Constant-time compare on each path; missing-secret cases fail closed.
function authorised(request, env) {
  const header = request.headers.get('authorization') || '';

  if (env.CRON_KEY && header.startsWith('Bearer ')) {
    const expected = `Bearer ${env.CRON_KEY}`;
    if (timingSafeStringEqual(header, expected)) return true;
  }

  if (env.ADMIN_USER && env.ADMIN_PASS && header.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = atob(header.slice(6).trim()); } catch { return false; }
    const expected = `${env.ADMIN_USER}:${env.ADMIN_PASS}`;
    if (timingSafeStringEqual(decoded, expected)) return true;
  }

  return false;
}

function timingSafeStringEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ADMIN_REALM = 'WWW-Authenticate';
const ADMIN_REALM_VALUE = 'Basic realm="buddyAI admin", charset="UTF-8"';

function unauthorised(forBrowser) {
  return new Response(forBrowser ? 'Authentication required' : 'forbidden', {
    status: forBrowser ? 401 : 403,
    headers: forBrowser ? { [ADMIN_REALM]: ADMIN_REALM_VALUE } : {},
  });
}
