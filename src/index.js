import {
  askClaude,
  generateContextualExplainer,
  generateDailyNewsForHoldings,
  generateHoldingsStatus,
  generatePicksViaClaude,
  generatePortfolioAnalysis,
  generatePortfolioComparison,
  generatePortfolioRebalance,
} from './claude.js';
import {
  applyPendingTransactions,
  clearActiveGoal,
  clearHistory,
  clearPortfolios,
  confirmPendingPortfolio,
  deleteDcaOverride,
  deletePendingPortfolio,
  deletePendingTransactions,
  deletePortfolioById,
  getActiveGoal,
  getActivePortfolio,
  getContributionsByClass,
  getContributionsThisMonth,
  getContributionsTotal,
  getDcaOverride,
  getDividendsTotalAllTime,
  getDividendsYtd,
  getHistory,
  getJourney,
  getNewsSubscribedUsers,
  getPendingPortfolio,
  getPendingTransactions,
  getPortfolioSnapshots,
  getPortfolioWithHoldings,
  getSubscribedUsers,
  getTradingDiary,
  getUsersWithActiveGoals,
  listContributions,
  listDcaOverrides,
  listDividends,
  listPortfolios,
  listTransactions,
  logEvent,
  recordBuy,
  recordContribution,
  recordDividend,
  recordSell,
  renamePortfolio,
  saveGoal,
  savePendingPortfolio,
  savePendingTransactions,
  saveMessage,
  setActivePortfolio,
  setDcaOverride,
  togglePendingTransactionSelection,
  subscribeAlert,
  subscribeNews,
  unsubscribeAlert,
  unsubscribeNews,
  updateGoalFields,
  updatePortfolioFromPending,
  upsertUser,
} from './db.js';
import { enrollmentCard } from './flex/enrollment.js';
import { postSaveGoalNudgeCard, welcomeDemoCard, welcomeWealthOSCard } from './flex/welcome.js';
import { dailyAlertCard } from './flex/dailyAlert.js';
import { dailyNewsCard } from './flex/news.js';
import { oilLiffCard, stockLiffCard } from './flex/liffCards.js';
import {
  actionAckCard,
  holdingsStatusCard,
  portfolioAnalysisCard,
  portfolioCompareCard,
  portfolioConfirmCard,
  portfolioHistoryCard,
  portfolioHistoryCarousel,
  portfolioListCard,
  portfolioRebalanceCard,
  portfolioSummaryCard,
  tradingDiaryCard,
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
import { fetchAndStoreFxRates } from './fx.js';
import { backfillAssetClasses, getNetWorth, tagSymbolClass } from './wealth.js';
import { inferAssetClass, isValidClass, ASSET_CLASSES } from './assetclass.js';
import { netWorthCard } from './flex/wealth.js';
import {
  DEFAULT_ALLOCATION,
  DEFAULT_EXPECTED_RETURN_PCT,
  expectedFutureValue,
  impliedAnnualReturnPct,
  monthsToTarget,
  monthsToTargetYear,
  monthsUntil,
  parseAllocation,
  parseAmount,
  parseHorizon,
  parseYearMonth,
  requiredAnnualReturnPct,
  requiredMonthlyToTarget,
  solveMonthlyContribution,
  validateAllocation,
  validateExpectedReturn,
  validateTargetAmount,
  validateTargetYear,
} from './goals.js';
import { dcaOverridesCard, goalCard, goalConfirmCard, goalEditMenuCard } from './flex/goal.js';
import {
  DRIFT_THRESHOLD_PP,
  bangkokWeekRange,
  bangkokWeekToken,
  bangkokYearMonth,
  computeDrift,
  evaluateUserNudges,
  markDcaSent,
  markDriftSent,
  markWeeklySent,
} from './nudges.js';
import { dcaReminderCard, driftNudgeCard } from './flex/nudges.js';
import { weeklyStatusCard } from './flex/weeklyStatus.js';
import { dividendConfirmCard, dividendsListCard } from './flex/dividends.js';
import { aiExplainerCard, topicCard, topicListCard } from './flex/education.js';
import { findTopic, listTopicsByCategory } from './education/topics.js';
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
  '• "ความมั่งคั่ง" / "net worth" — สรุปความมั่งคั่งสุทธิรวมทุกพอร์ตเป็นเงินบาท',
  '• "ติด <SYM> <ประเภท>" — ติดป้ายประเภทสินทรัพย์ (thai_equity, global_etf, thai_fund, cash, hk_equity, crypto)',
  '• "ตั้งเป้าหมาย" — ตั้งเป้าความมั่งคั่งระยะยาวพร้อมแผน DCA',
  '• "เป้าหมาย" / "goal" — ดูเป้าหมายและความก้าวหน้า',
  '• "ปรับเป้าหมาย" — เมนูแก้ไขเป้าหมาย (ยอด/ปี/ผลตอบแทน/DCA/สัดส่วน)',
  '• "ปรับเป้า <จำนวน>" / "ปรับปี <year>" / "ปรับผลตอบแทน <%>" / "ปรับ DCA <จำนวน>" / "ปรับสัดส่วน <a b c>" — แก้ทีละช่อง',
  '• "ปรับ DCA <จำนวน> <YYYY-MM>" — ตั้ง DCA เฉพาะเดือน เช่น "ปรับ DCA 80000 2026-06"',
  '• "ตาราง dca" / "ดู dca" — ดูตารางการเติม DCA ทุกเดือน',
  '• "ลบ DCA <YYYY-MM>" — ลบ override เดือนนั้น',
  '• "เติม <จำนวน> [<ประเภท>]" — บันทึก DCA เช่น "เติม 30000" หรือ "เติม 30K thai_equity"',
  '• "ปันผล <SYM> <จำนวน>" — บันทึกปันผลที่ได้รับ (หรือ "ปันผล PTT 2.15 1000" สำหรับ ต่อหุ้น × จำนวน)',
  '• "รายการปันผล" — ดูปันผลที่บันทึกไว้ + ยอดสะสมปีนี้',
  '• "อธิบาย" — ห้องสมุดอธิบายเรื่องการเงิน (DCA, ปันผล, P/E, ETF ฯลฯ)',
  '• "อธิบาย <คำ>" — อธิบายคำศัพท์การเงิน เช่น "อธิบาย yield trap"',
  '• "ลบเป้าหมาย" — ลบเป้าหมายปัจจุบัน',
  '• "พอร์ต" — ดูพอร์ตที่ใช้งานอยู่',
  '• "พอร์ตทั้งหมด" — รายการพอร์ตทั้งหมด เลือก/ลบได้',
  '• "เปลี่ยนชื่อ <ชื่อใหม่>" — เปลี่ยนชื่อพอร์ตที่ใช้งานอยู่',
  '• "สถานะหุ้น" — ราคาล่าสุด + คำแนะนำรายตัว',
  '• "ซื้อ <SYMBOL> <จำนวน> @ <ราคา>" — บันทึกการซื้อหุ้น (เช่น ซื้อ PTT 100 @ 35.50)',
  '• "ขาย <SYMBOL> <จำนวน> @ <ราคา>" — บันทึกการขายหุ้น',
  '• "รายการซื้อขาย" — ดูประวัติการซื้อขายของพอร์ต',
  '• "ไดอารี่" — สรุป P/L สะสม + win-rate + รายการขายที่เด่น (พิมพ์ "ไดอารี่ 30" หรือ "ไดอารี่ <SYM>" เพื่อกรอง)',
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

    if (url.pathname === '/test-fx') {
      if (!authorised(request, env)) return unauthorised(false);
      ctx.waitUntil(runFxCron(env));
      return json({ ok: true, triggered: 'daily-fx' });
    }

    if (url.pathname === '/test-nudges') {
      if (!authorised(request, env)) return unauthorised(false);
      const force = url.searchParams.get('force') === '1';
      ctx.waitUntil(runNudgesCron(env, { force }));
      return json({ ok: true, triggered: 'daily-nudges', force });
    }

    if (url.pathname === '/test-weekly-status') {
      if (!authorised(request, env)) return unauthorised(false);
      const force = url.searchParams.get('force') === '1';
      ctx.waitUntil(runWeeklyStatusCron(env, { force }));
      return json({ ok: true, triggered: 'weekly-status', force });
    }

    if (url.pathname === '/test-subs') {
      if (!authorised(request, env)) return unauthorised(false);
      const subs = await getSubscribedUsers(env);
      return json({ ok: true, count: subs.length, subs });
    }

    if (url.pathname === '/test-log') {
      if (!authorised(request, env)) return unauthorised(false);
      const [alertLog, newsLog, fxLog, nudgesLog, weeklyLog] = await Promise.all([
        env.SESSION_KV.get('cron:last-run'),
        env.SESSION_KV.get('news:last-run'),
        env.SESSION_KV.get('fx:last-run'),
        env.SESSION_KV.get('nudges:last-run'),
        env.SESSION_KV.get('weekly:last-run'),
      ]);
      return json({
        ok: true,
        alert: alertLog ? JSON.parse(alertLog) : null,
        news: newsLog ? JSON.parse(newsLog) : null,
        fx: fxLog ? JSON.parse(fxLog) : null,
        nudges: nudgesLog ? JSON.parse(nudgesLog) : null,
        weekly: weeklyLog ? JSON.parse(weeklyLog) : null,
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
  // WealthOS-themed welcome: three-step orientation aligned with the deck's
  // SEE / PLAN / ACT structure, replacing the older alert-subscription
  // enrollment card.
  await reply(env, ev.replyToken, welcomeWealthOSCard({
    displayName: profile?.displayName || null,
  }));
}

async function handlePostback(ev, env, userId) {
  const data = new URLSearchParams(ev.postback?.data || '');
  const action = data.get('action');

  if (action === 'subscribe') {
    await subscribeAlert(env, userId);
    await logEvent(env, userId, 'subscribe', { via: 'postback' });
    return reply(env, ev.replyToken, actionAckCard({
      title: 'สมัครการแจ้งเตือนแล้ว',
      subtitle: 'รับหุ้นเด่นทุกเช้า 09:00 (จันทร์–ศุกร์)',
    }));
  }
  if (action === 'unsubscribe') {
    await unsubscribeAlert(env, userId);
    await logEvent(env, userId, 'unsubscribe', { via: 'postback' });
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยกเลิกการแจ้งเตือนแล้ว',
    }));
  }

  if (action === 'confirm-portfolio') {
    const portfolioId = await confirmPendingPortfolio(env, userId);
    if (!portfolioId) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: 'หมดเวลายืนยัน',
        subtitle: 'ไม่พบข้อมูลพอร์ตค้างไว้ — ลองส่งภาพใหม่อีกครั้งนะครับ',
      }));
    }
    const saved = await getActivePortfolio(env, userId).catch(() => null);
    await logEvent(env, userId, 'portfolio_saved', {
      portfolio_id: portfolioId,
      name: saved?.portfolio?.name || null,
      source: saved?.portfolio?.source || null,
      total_value: saved?.portfolio?.total_value ?? null,
      symbols: (saved?.holdings || []).map((h) => h.symbol),
    });

    // If the user doesn't yet have an active goal, surface a richer
    // "next-step" card pointing at the goal wizard — closes the wealth-OS
    // loop. Otherwise keep the existing minimal ack so we don't pester
    // returning users who already set their plan.
    const existingGoal = await getActiveGoal(env, userId).catch(() => null);
    if (!existingGoal) {
      return reply(env, ev.replyToken, postSaveGoalNudgeCard({
        portfolioName: saved?.portfolio?.name || 'พอร์ต',
        holdingCount: (saved?.holdings || []).length,
      }));
    }
    return reply(env, ev.replyToken, actionAckCard({
      title: `บันทึก "${saved?.portfolio?.name || 'พอร์ต'}" แล้ว`,
      subtitle: 'ตั้งเป็นพอร์ตที่ใช้งานปัจจุบันแล้ว',
      lines: [
        { label: 'หุ้น', value: String((saved?.holdings || []).length) + ' ตัว' },
        ...(saved?.portfolio?.total_value != null
          ? [{ label: 'มูลค่ารวม', value: Number(saved.portfolio.total_value).toLocaleString('en-US') }]
          : []),
        { text: 'พิมพ์ "ความมั่งคั่ง" เพื่อดูสรุปทรัพย์สิน หรือ "เป้าหมาย" เพื่อดูแผน DCA', color: '#475569' },
      ],
    }));
  }

  if (action === 'update-portfolio') {
    const id = Number(data.get('id'));
    if (!Number.isFinite(id)) return reply(env, ev.replyToken, textMsg('คำสั่งไม่ถูกต้อง'));
    const result = await updatePortfolioFromPending(env, userId, id);
    if (!result) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: 'อัพเดตไม่สำเร็จ',
        subtitle: 'ไม่พบพอร์ตหรือหมดเวลายืนยัน — ส่งภาพพอร์ตใหม่อีกครั้งนะครับ',
      }));
    }
    const updated = await getPortfolioWithHoldings(env, userId, id);
    await logEvent(env, userId, 'portfolio_updated', {
      portfolio_id: id,
      snapshot_id: result.snapshotId,
      name: updated?.portfolio?.name || null,
      total_value: updated?.portfolio?.total_value ?? null,
      symbols: (updated?.holdings || []).map((h) => h.symbol),
    });
    return reply(env, ev.replyToken, actionAckCard({
      title: `อัพเดต "${updated?.portfolio?.name || 'พอร์ต'}" แล้ว`,
      subtitle: 'เก็บ snapshot เดิมไว้ในประวัติเรียบร้อย',
      lines: [
        { label: 'หุ้น', value: String((updated?.holdings || []).length) + ' ตัว' },
        ...(updated?.portfolio?.total_value != null
          ? [{ label: 'มูลค่ารวมล่าสุด', value: Number(updated.portfolio.total_value).toLocaleString('en-US') }]
          : []),
      ],
      cta: { label: 'ดูประวัติพอร์ต', data: 'action=show-portfolio-history' },
    }));
  }

  if (action === 'retry-portfolio') {
    await deletePendingPortfolio(env, userId);
    await logEvent(env, userId, 'portfolio_retry', null);
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยกเลิกแล้ว',
      subtitle: 'ส่งภาพพอร์ตอีกครั้งได้เลย',
    }));
  }

  if (action === 'select-portfolio') {
    const id = Number(data.get('id'));
    if (!Number.isFinite(id)) return reply(env, ev.replyToken, textMsg('คำสั่งไม่ถูกต้อง'));
    const ok = await setActivePortfolio(env, userId, id);
    if (!ok) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: 'ไม่พบพอร์ตนั้น',
        subtitle: 'อาจถูกลบไปแล้ว',
      }));
    }
    await logEvent(env, userId, 'portfolio_switched', { portfolio_id: id });
    const active = await getActivePortfolio(env, userId);
    return reply(env, ev.replyToken, actionAckCard({
      title: `เลือก "${active?.portfolio?.name || 'พอร์ต'}" เป็นพอร์ตที่ใช้งานแล้ว`,
      lines: [
        { label: 'หุ้น', value: String((active?.holdings || []).length) + ' ตัว' },
      ],
    }));
  }

  if (action === 'delete-portfolio') {
    const id = Number(data.get('id'));
    if (!Number.isFinite(id)) return reply(env, ev.replyToken, textMsg('คำสั่งไม่ถูกต้อง'));
    const ok = await deletePortfolioById(env, userId, id);
    if (!ok) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: 'ไม่พบพอร์ตนั้น',
      }));
    }
    await logEvent(env, userId, 'portfolio_deleted', { portfolio_id: id });
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ลบพอร์ตแล้ว',
    }));
  }

  if (action === 'show-portfolio-history') {
    return showPortfolioHistory(ev, env, userId);
  }

  if (action === 'confirm-goal') {
    return confirmGoalFromWizard(ev, env, userId);
  }
  if (action === 'cancel-goal-wizard') {
    await deleteGoalWizardState(env, userId);
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยกเลิกการตั้งเป้าหมายแล้ว',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" เพื่อเริ่มใหม่ได้ทุกเมื่อ',
    }));
  }
  if (action === 'goal-log-monthly') {
    return logGoalMonthlyContribution(ev, env, userId);
  }

  if (action === 'goal-edit') {
    const field = data.get('field');
    return startGoalEditStep(ev, env, userId, field);
  }

  if (action === 'goal-delete-dca-override') {
    const ym = data.get('ym');
    return deleteDcaOverrideHandler(ev, env, userId, { ym });
  }

  if (action === 'list-dca-overrides') {
    return showDcaOverrides(ev, env, userId);
  }

  if (action === 'dca-override-wizard') {
    return startDcaOverrideWizard(ev, env, userId);
  }

  if (action === 'welcome-demo') {
    return reply(env, ev.replyToken, welcomeDemoCard());
  }

  if (action === 'list-transactions') {
    return showTransactions(ev, env, userId);
  }

  if (action === 'diary-scope') {
    const days = Number(data.get('days')) || 0;
    return showTradingDiary(ev, env, userId, { days: days > 0 ? days : null, symbol: null });
  }

  if (action === 'toggle-import-row') {
    const idx = Number(data.get('idx'));
    const blob = await togglePendingTransactionSelection(env, userId, idx);
    if (!blob) {
      return reply(env, ev.replyToken, textMsg('หมดเวลายืนยัน — ส่งภาพรายการซื้อขายอีกครั้งครับ'));
    }
    const active = await getActivePortfolio(env, userId).catch(() => null);
    return reply(env, ev.replyToken, transactionsImportConfirmCard({
      extracted: blob,
      portfolioName: active?.portfolio?.name || null,
    }));
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

  // Goal-wizard interception: if user has an active wizard and didn't type
  // a recognised command, treat the input as the answer to the current step.
  // A recognised command silently cancels the wizard (the user clearly
  // changed their mind).
  const wizardState = await getGoalWizardState(env, userId);
  if (wizardState && !cmd) {
    return handleGoalWizardAnswer(ev, env, userId, text, wizardState);
  }
  if (wizardState && cmd) {
    await deleteGoalWizardState(env, userId);
    // fall through to the matched command
  }

  if (cmd === 'help') {
    return reply(env, ev.replyToken, textMsg(HELP_TH));
  }
  if (cmd === 'reset') {
    await clearHistory(env, userId);
    await deleteSession(env, userId);
    await logEvent(env, userId, 'reset_chat', null);
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ล้างประวัติแชทแล้ว',
      subtitle: 'เริ่มใหม่ได้เลย',
    }));
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
    return reply(env, ev.replyToken, actionAckCard({
      title: 'สมัครการแจ้งเตือนแล้ว',
      subtitle: 'รับหุ้นเด่นทุกเช้า 09:00 (จันทร์–ศุกร์)',
    }));
  }
  if (cmd === 'unsubscribe') {
    await unsubscribeAlert(env, userId);
    await logEvent(env, userId, 'unsubscribe', { via: 'text' });
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยกเลิกการแจ้งเตือนแล้ว',
    }));
  }
  if (cmd === 'subscribe-news') {
    await upsertUser(env, { userId });
    await subscribeNews(env, userId);
    await logEvent(env, userId, 'subscribe_news', { via: 'text' });
    return reply(env, ev.replyToken, actionAckCard({
      title: 'สมัครข่าวประจำวันแล้ว',
      subtitle: 'รับข่าวพอร์ตของคุณทุกเช้า 08:00 (จันทร์–ศุกร์)',
    }));
  }
  if (cmd === 'unsubscribe-news') {
    await unsubscribeNews(env, userId);
    await logEvent(env, userId, 'unsubscribe_news', { via: 'text' });
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยกเลิกข่าวประจำวันแล้ว',
    }));
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
  if (cmd === 'diary') {
    return showTradingDiary(ev, env, userId, match.arg);
  }
  if (cmd === 'net-worth') {
    return showNetWorth(ev, env, userId);
  }
  if (cmd === 'tag-asset-class') {
    return tagAssetClassHandler(ev, env, userId, match.arg);
  }
  if (cmd === 'goal-wizard-start') {
    return startGoalWizard(ev, env, userId);
  }
  if (cmd === 'show-goal') {
    return showGoal(ev, env, userId);
  }
  if (cmd === 'clear-goal') {
    return clearGoalHandler(ev, env, userId);
  }
  if (cmd === 'goal-edit-menu') {
    return showGoalEditMenu(ev, env, userId);
  }
  if (cmd === 'goal-edit-field') {
    return applyGoalFieldEdit(ev, env, userId, match.arg);
  }
  if (cmd === 'goal-set-dca-override') {
    return setDcaOverrideHandler(ev, env, userId, match.arg);
  }
  if (cmd === 'list-dca-overrides') {
    return showDcaOverrides(ev, env, userId);
  }
  if (cmd === 'goal-delete-dca-override') {
    return deleteDcaOverrideHandler(ev, env, userId, match.arg);
  }
  if (cmd === 'contribute') {
    return recordContributionHandler(ev, env, userId, match.arg);
  }
  if (cmd === 'list-dividends') {
    return showDividendsList(ev, env, userId);
  }
  if (cmd === 'record-dividend') {
    return recordDividendHandler(ev, env, userId, match.arg);
  }
  if (cmd === 'list-topics') {
    return showTopicList(ev, env, userId);
  }
  if (cmd === 'explain-topic') {
    return explainTopicHandler(ev, env, userId, match.arg);
  }
  if (cmd === 'rename-portfolio') {
    const newName = match.arg;
    if (!newName) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: 'พิมพ์ชื่อใหม่ด้วย',
        subtitle: 'รูปแบบ: "เปลี่ยนชื่อ <ชื่อใหม่>"',
      }));
    }
    const active = await getActivePortfolio(env, userId);
    if (!active) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'info',
        title: 'ยังไม่มีพอร์ตที่ใช้งาน',
      }));
    }
    const oldName = active.portfolio.name;
    const ok = await renamePortfolio(env, userId, active.portfolio.id, newName);
    if (!ok) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: 'ไม่สามารถเปลี่ยนชื่อได้',
      }));
    }
    const trimmed = newName.trim().slice(0, 60);
    await logEvent(env, userId, 'portfolio_renamed', {
      portfolio_id: active.portfolio.id,
      from: oldName,
      to: trimmed,
    });
    return reply(env, ev.replyToken, actionAckCard({
      title: 'เปลี่ยนชื่อพอร์ตแล้ว',
      lines: [
        { label: 'จาก', value: `"${oldName}"`, color: '#94A3B8' },
        { label: 'เป็น', value: `"${trimmed}"` },
      ],
    }));
  }
  if (cmd === 'clear-portfolio') {
    await clearPortfolios(env, userId);
    await logEvent(env, userId, 'portfolio_cleared', null);
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ลบข้อมูลพอร์ตทั้งหมดแล้ว',
    }));
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

async function showTradingDiary(ev, env, userId, arg) {
  const active = await getActivePortfolio(env, userId);
  if (!active) {
    return reply(env, ev.replyToken, textMsg('ยังไม่มีพอร์ตที่ใช้งาน — ส่งภาพพอร์ตเพื่อเริ่มต้น'));
  }
  const days = arg?.days || null;
  const symbol = arg?.symbol || null;
  const diary = await getTradingDiary(env, userId, active.portfolio.id, { days, symbol });
  if (!diary) {
    return reply(env, ev.replyToken, textMsg('ไม่พบข้อมูลพอร์ต'));
  }
  await logEvent(env, userId, 'diary_viewed', {
    portfolio_id: active.portfolio.id,
    scope: { days, symbol },
    closed_count: diary.stats.closed_count,
    total_realized_pl: diary.stats.total_realized_pl,
  });
  return reply(env, ev.replyToken, tradingDiaryCard(diary));
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
  // List every saved portfolio. If only one exists, show its single bubble;
  // otherwise render a carousel with the active portfolio first and the rest
  // ordered by most-recently-updated.
  const portfolios = await listPortfolios(env, userId);
  if (!portfolios.length) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่มีพอร์ตที่ใช้งาน',
      subtitle: 'ส่งภาพพอร์ตจากแอปโบรกเกอร์เพื่อเริ่มต้น',
    }));
  }

  // Sort: active first, then by taken_at desc (already the listPortfolios order).
  const sorted = [...portfolios].sort((a, b) => {
    const aActive = a.is_active === 1 ? 1 : 0;
    const bActive = b.is_active === 1 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return (b.taken_at || 0) - (a.taken_at || 0);
  });

  const items = await Promise.all(sorted.map(async (p) => {
    const snapshots = await getPortfolioSnapshots(env, userId, p.id, 20).catch(() => []);
    return { portfolio: p, snapshots, isActive: p.is_active === 1 };
  }));

  // If a single portfolio has no snapshots either, the active-only friendly
  // message is more useful than a carousel of one bubble with no timeline.
  if (items.length === 1 && items[0].snapshots.length === 0) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: `"${items[0].portfolio.name}" ยังไม่มีประวัติ`,
      subtitle: 'ครั้งต่อไปที่ส่งภาพ ให้กด "อัพเดต" เพื่อเก็บ snapshot ไว้ดูย้อนหลังได้',
    }));
  }

  return reply(env, ev.replyToken, portfolioHistoryCarousel(items));
}

function formatTakenAt(unix) {
  if (!unix) return '—';
  // Force Gregorian calendar so the year reads as "2025" not "2568"
  // (Buddhist Era), matching the rest of the bot's date display.
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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

  // Trading diary — three forms:
  //   ไดอารี่              (active portfolio, all-time)
  //   ไดอารี่ 30 / ไดอารี่ 90  (last N days)
  //   ไดอารี่ <SYM>           (per-symbol zoom)
  const diaryMatch = t.match(/^(ไดอารี่|ไดอารี|diary|journal)(?:\s+(.+))?$/i);
  if (diaryMatch) {
    const arg = (diaryMatch[2] || '').trim();
    if (!arg) return { cmd: 'diary', arg: { days: null, symbol: null } };
    if (/^\d+$/.test(arg)) return { cmd: 'diary', arg: { days: Number(arg), symbol: null } };
    if (/^[A-Za-z0-9.\-]+$/.test(arg)) return { cmd: 'diary', arg: { days: null, symbol: arg.toUpperCase() } };
    return { cmd: 'diary', arg: { days: null, symbol: null } };
  }

  // AIWealthOS Phase 1 — net worth view
  if (['ความมั่งคั่ง', 'ความมั่งคั่งสุทธิ', 'รายงานทรัพย์สิน', 'net worth', 'networth', 'wealth'].includes(tl)) {
    return { cmd: 'net-worth' };
  }

  // AIWealthOS Phase 1.2 — goals + DCA
  if (['ตั้งเป้าหมาย', 'เป้าหมายใหม่', 'set goal', 'new goal'].includes(tl)) {
    return { cmd: 'goal-wizard-start' };
  }
  if (['เป้าหมาย', 'goal', 'plan'].includes(tl)) {
    return { cmd: 'show-goal' };
  }
  if (['ลบเป้าหมาย', 'ยกเลิกเป้าหมาย', 'clear goal'].includes(tl)) {
    return { cmd: 'clear-goal' };
  }

  // In-place edits of the active goal — open the menu card or jump
  // straight to a field via text shortcut.
  if (['ปรับเป้าหมาย', 'แก้เป้าหมาย', 'edit goal'].includes(tl)) {
    return { cmd: 'goal-edit-menu' };
  }
  const editAmount = t.match(/^(?:ปรับเป้า|ปรับยอด|edit target|edit amount)\s+(.+)$/i);
  if (editAmount) return { cmd: 'goal-edit-field', arg: { field: 'amount', raw: editAmount[1].trim() } };
  const editYear = t.match(/^(?:ปรับปี|edit year|edit horizon)\s+(.+)$/i);
  if (editYear) return { cmd: 'goal-edit-field', arg: { field: 'horizon', raw: editYear[1].trim() } };
  const editReturn = t.match(/^(?:ปรับผลตอบแทน|edit return)\s+(.+)$/i);
  if (editReturn) return { cmd: 'goal-edit-field', arg: { field: 'return', raw: editReturn[1].trim() } };
  const editAlloc = t.match(/^(?:ปรับสัดส่วน|edit allocation)\s+(.+)$/i);
  if (editAlloc) return { cmd: 'goal-edit-field', arg: { field: 'allocation', raw: editAlloc[1].trim() } };
  // Per-month DCA override — generous about how the month gets typed. The
  // override variant must match before the standing-amount edit so the
  // trailing month token isn't swallowed as part of the amount.
  //
  // First, try the strict shape "<verb> <amount> <month-token>". The amount
  // is a number-or-K/M shortcut at the front; everything after the next
  // whitespace is the month token (Thai/English name, YYYY-MM, MM/YYYY,
  // "เดือนหน้า", etc — parseYearMonth handles all of them).
  const dcaVerb = '(?:ปรับ\\s?dca|ปรับเงินเติม|เพิ่ม\\s?dca|ตั้ง\\s?dca|set\\s?dca|edit\\s?dca|edit\\s?monthly|dca)';
  const dcaWithMonth = t.match(new RegExp(
    `^${dcaVerb}\\s+([\\d.,]+[MmKk]?)\\s+(.+)$`,
    'i',
  ));
  if (dcaWithMonth) {
    const ym = parseYearMonth(dcaWithMonth[2]);
    if (ym) {
      return {
        cmd: 'goal-set-dca-override',
        arg: { rawAmount: dcaWithMonth[1], ym },
      };
    }
  }
  // No recognisable month → standing-amount edit (just the number)
  const editDca = t.match(new RegExp(`^${dcaVerb}\\s+(.+)$`, 'i'));
  if (editDca) return { cmd: 'goal-edit-field', arg: { field: 'dca', raw: editDca[1].trim() } };

  // List + delete DCA overrides
  if (['ดู dca', 'ดูdca', 'ตาราง dca', 'รายการ dca', 'list dca', 'dca schedule'].includes(tl)) {
    return { cmd: 'list-dca-overrides' };
  }
  const deleteDcaMatch = t.match(/^(?:ลบ\s?dca|ยกเลิก\s?dca|delete dca|remove dca|clear dca)\s+(.+)$/i);
  if (deleteDcaMatch) {
    const ym = parseYearMonth(deleteDcaMatch[1]);
    if (ym) return { cmd: 'goal-delete-dca-override', arg: { ym } };
  }

  // เติม <amount> [<class>]   →  log a DCA contribution
  //   เติม 30000              → split per goal allocation
  //   เติม 30000 thai_equity   → all into one class
  //   เติม 30K global_etf      → with M/K suffix
  const contribMatch = t.match(/^(เติม|dca|contribute)\s+([\d.,]+[MmKk]?)(?:\s+([a-z_]+))?$/i);
  if (contribMatch) {
    return {
      cmd: 'contribute',
      arg: {
        amountRaw: contribMatch[2],
        assetClass: contribMatch[3] ? contribMatch[3].toLowerCase() : null,
      },
    };
  }

  // AIWealthOS Phase 3 — dividends
  if (['ปันผล', 'รายการปันผล', 'ปันผลทั้งหมด', 'dividends', 'div'].includes(tl)) {
    return { cmd: 'list-dividends' };
  }

  // AIWealthOS Phase 4 — LEARN module
  if (['อธิบาย', 'หัวข้ออธิบาย', 'explain', 'glossary', 'learn'].includes(tl)) {
    return { cmd: 'list-topics' };
  }
  const explainMatch = t.match(/^(?:อธิบาย|explain)\s+(.+)$/i);
  if (explainMatch) {
    return { cmd: 'explain-topic', arg: { query: explainMatch[1].trim() } };
  }
  // ปันผล <SYM> <amount>                — net amount received
  // ปันผล <SYM> <per_share> @ <qty>      — per-share × quantity (with optional @ separator)
  // ปันผล <SYM> <per_share> <qty>        — same, space-separated
  const dividendMatch = t.match(
    /^(?:ปันผล|dividend)\s+([A-Za-z0-9.\-]+)\s+([\d.,]+)(?:\s*@?\s*([\d.,]+))?$/i,
  );
  if (dividendMatch) {
    return {
      cmd: 'record-dividend',
      arg: {
        symbol: dividendMatch[1].toUpperCase(),
        firstNum: dividendMatch[2],
        secondNum: dividendMatch[3] || null,
      },
    };
  }

  // Asset class tagging: "ติด <SYM> <class>"
  //   ติด VOO global_etf      → tag VOO as global ETF
  //   ติด SCBGOLD thai_fund    → tag SCBGOLD as Thai mutual fund
  const tagMatch = t.match(/^(ติด|tag)\s+([A-Za-z0-9.\-]+)\s+([a-z_]+)$/i);
  if (tagMatch) {
    return {
      cmd: 'tag-asset-class',
      arg: { symbol: tagMatch[2].toUpperCase(), assetClass: tagMatch[3].toLowerCase() },
    };
  }

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

// ────────────────────────────────────────────────────────────────────────
// AIWealthOS Phase 1 — net worth + FX
// ────────────────────────────────────────────────────────────────────────

async function showNetWorth(ev, env, userId) {
  // On first call after migration, backfill asset classes for the user's
  // legacy holdings. Cheap and idempotent — runs once meaningful work then
  // exits early on subsequent calls because the inferred class already matches.
  await backfillAssetClasses(env, userId, inferAssetClass).catch(() => {});

  const [netWorth, goal] = await Promise.all([
    getNetWorth(env, userId),
    getActiveGoal(env, userId).catch(() => null),
  ]);
  await logEvent(env, userId, 'net_worth_viewed', {
    total_thb: Math.round(netWorth.total_thb || 0),
    class_count: (netWorth.breakdown || []).length,
    portfolio_count: (netWorth.portfolios || []).length,
    fx_fetched_at: netWorth.fx_fetched_at,
    has_goal: !!goal,
  });
  return reply(env, ev.replyToken, netWorthCard({ netWorth, hasGoal: !!goal }));
}

async function tagAssetClassHandler(ev, env, userId, arg) {
  const { symbol, assetClass } = arg || {};
  if (!isValidClass(assetClass)) {
    const valid = Object.keys(ASSET_CLASSES).join(', ');
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'ประเภทสินทรัพย์ไม่ถูกต้อง',
      subtitle: `เลือกจาก: ${valid}`,
    }));
  }
  const result = await tagSymbolClass(env, userId, symbol, assetClass);
  if (!result.ok) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'ติดป้ายไม่สำเร็จ',
    }));
  }
  if (result.changed === 0) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: `ไม่พบ ${result.symbol} ในพอร์ตของคุณ`,
    }));
  }
  await logEvent(env, userId, 'asset_class_tagged', {
    symbol: result.symbol,
    class: result.class,
    changed: result.changed,
  });
  const meta = ASSET_CLASSES[assetClass];
  return reply(env, ev.replyToken, actionAckCard({
    title: `ติดป้าย ${result.symbol} เป็น "${meta.label}" แล้ว`,
    subtitle: `${meta.emoji} อัพเดต ${result.changed} แถว`,
  }));
}

// ────────────────────────────────────────────────────────────────────────
// AIWealthOS Phase 1.2 — goal wizard + DCA contributions
//
// Wizard state lives in KV under `goal-wizard:<userId>` with a 30-min TTL.
// Shape: { step: 'target' | 'horizon' | 'allocation' | 'return' | 'confirm',
//          data: { targetAmountThb?, targetYear?, allocation?, expectedReturnPct? } }
// ────────────────────────────────────────────────────────────────────────

const GOAL_WIZARD_PREFIX = 'goal-wizard:';
const GOAL_WIZARD_TTL = 60 * 30;

async function getGoalWizardState(env, userId) {
  const raw = await env.SESSION_KV.get(GOAL_WIZARD_PREFIX + userId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveGoalWizardState(env, userId, state) {
  await env.SESSION_KV.put(
    GOAL_WIZARD_PREFIX + userId,
    JSON.stringify(state),
    { expirationTtl: GOAL_WIZARD_TTL },
  );
}

async function deleteGoalWizardState(env, userId) {
  await env.SESSION_KV.delete(GOAL_WIZARD_PREFIX + userId);
}

async function startGoalWizard(ev, env, userId) {
  await upsertUser(env, { userId });
  await saveGoalWizardState(env, userId, {
    step: 'target',
    data: {},
  });
  await logEvent(env, userId, 'goal_wizard_started', null);
  return reply(env, ev.replyToken, actionAckCard({
    tone: 'info',
    title: '🎯 ตั้งเป้าหมายความมั่งคั่ง',
    subtitle: 'อยากมีเงินเก็บกี่บาทในอนาคต?',
    lines: [
      { text: 'ตอบกลับด้วยจำนวนเงิน เช่น "20M" สำหรับ 20 ล้านบาท หรือ "5000000" สำหรับ 5 ล้านบาท', color: '#475569' },
      { text: 'พิมพ์ "ยกเลิก" เพื่อหยุดการตั้งเป้า', color: '#94A3B8' },
    ],
  }));
}

async function handleGoalWizardAnswer(ev, env, userId, text, state) {
  const trimmed = String(text || '').trim();

  // Universal cancel
  if (['ยกเลิก', 'cancel', 'หยุด', 'stop'].includes(trimmed.toLowerCase())) {
    await deleteGoalWizardState(env, userId);
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยกเลิกแล้ว',
    }));
  }

  // Edit mode — single-step. step holds the field name; answer goes straight
  // through applyGoalFieldEdit which patches the goal + recomputes monthly
  // contribution when needed.
  if (state.mode === 'edit') {
    return applyGoalFieldEdit(ev, env, userId, {
      field: state.step,
      raw: trimmed,
    });
  }

  // DCA override wizard — 2 steps: month → amount. Both inputs are run
  // through forgiving parsers (parseYearMonth handles "มิ.ย. 2026" /
  // "เดือนหน้า" / "2026-06" all the same; parseAmount handles "30K" /
  // "30000" / "1.5M"). Validation errors prompt a retry without losing
  // state, so a typo doesn't kick the user out.
  if (state.mode === 'dca-override') {
    if (state.step === 'month') {
      const ym = parseYearMonth(trimmed);
      if (!ym) {
        return reply(env, ev.replyToken, actionAckCard({
          tone: 'warning',
          title: 'ไม่เข้าใจเดือนที่พิมพ์',
          subtitle: 'พิมพ์ใหม่ เช่น "มิ.ย. 2026" / "2026-06" / "เดือนหน้า"',
        }));
      }
      state.step = 'amount';
      state.data.ym = ym;
      await saveGoalWizardState(env, userId, state);
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'info',
        title: `ตั้ง DCA สำหรับ ${ym}`,
        subtitle: 'พิมพ์จำนวนเงิน เช่น "80000" หรือ "80K"',
      }));
    }
    if (state.step === 'amount') {
      const amount = parseAmount(trimmed);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
        return reply(env, ev.replyToken, actionAckCard({
          tone: 'warning',
          title: 'จำนวนเงินไม่ถูกต้อง',
          subtitle: 'พิมพ์ใหม่ เช่น "80000" หรือ "80K"',
        }));
      }
      const ym = state.data.ym;
      await deleteGoalWizardState(env, userId);
      return setDcaOverrideHandler(ev, env, userId, {
        rawAmount: String(amount),
        ym,
      });
    }
  }

  if (state.step === 'target') {
    const amount = parseAmount(trimmed);
    const err = validateTargetAmount(amount);
    if (err) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: err,
        subtitle: 'ลองใหม่ เช่น "20M" หรือ "5000000"',
      }));
    }
    state.data.targetAmountThb = amount;
    state.step = 'horizon';
    await saveGoalWizardState(env, userId, state);
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: `เป้า ${amount.toLocaleString('en-US')} บาท · ขั้นต่อไป`,
      subtitle: 'ภายในกี่ปี? พิมพ์เลขปีที่ต้องการ เช่น "15" หรือพิมพ์ปีเป้า เช่น "2040"',
    }));
  }

  if (state.step === 'horizon') {
    const targetYear = parseHorizon(trimmed);
    const err = validateTargetYear(targetYear);
    if (err) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: err,
        subtitle: 'ลองใหม่ เช่น "15" (ปี) หรือ "2040" (ปี ค.ศ.)',
      }));
    }
    state.data.targetYear = targetYear;
    state.step = 'allocation';
    await saveGoalWizardState(env, userId, state);
    const years = targetYear - new Date().getUTCFullYear();
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: `อีก ${years} ปี (ปี ${targetYear}) · ขั้นต่อไป`,
      subtitle: 'จัดสัดส่วนการลงทุนยังไง?',
      lines: [
        { text: '• พิมพ์ "default" สำหรับ 60/30/10 (หุ้นไทย / ETF ต่างประเทศ / เงินสด)', color: '#475569' },
        { text: '• หรือพิมพ์เอง 3 ตัวเลขรวม 100 เช่น "70 20 10"', color: '#475569' },
      ],
    }));
  }

  if (state.step === 'allocation') {
    const alloc = parseAllocation(trimmed);
    const err = alloc ? validateAllocation(alloc) : 'อ่านสัดส่วนไม่ออก';
    if (err) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: err,
        subtitle: 'ลองใหม่ เช่น "default" หรือ "60 30 10"',
      }));
    }
    state.data.allocation = alloc;
    // We could ask a 4th question for expected return, but for the wedge
    // experience we use the default and let the user override later. Most
    // users won't have a strong opinion here on first setup.
    state.data.expectedReturnPct = DEFAULT_EXPECTED_RETURN_PCT;
    state.step = 'confirm';
    await saveGoalWizardState(env, userId, state);

    const monthly = solveMonthlyContribution({
      targetAmountThb: state.data.targetAmountThb,
      targetYear: state.data.targetYear,
      expectedReturnPct: state.data.expectedReturnPct,
    });
    state.data.monthlyContributionThb = monthly;
    await saveGoalWizardState(env, userId, state);

    return reply(env, ev.replyToken, goalConfirmCard({
      targetAmountThb: state.data.targetAmountThb,
      targetYear: state.data.targetYear,
      expectedReturnPct: state.data.expectedReturnPct,
      monthlyContributionThb: monthly,
      allocation: state.data.allocation,
    }));
  }

  if (state.step === 'confirm') {
    // User typed something instead of tapping the button — nudge them.
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'แตะปุ่ม "บันทึกเป็นเป้าหมาย" เพื่อยืนยัน',
      subtitle: 'หรือพิมพ์ "ยกเลิก" เพื่อตั้งใหม่',
    }));
  }

  // Shouldn't reach here
  await deleteGoalWizardState(env, userId);
  return reply(env, ev.replyToken, actionAckCard({
    tone: 'warning',
    title: 'การตั้งเป้าหมายสะดุด — เริ่มใหม่ได้',
    subtitle: 'พิมพ์ "ตั้งเป้าหมาย"',
  }));
}

async function confirmGoalFromWizard(ev, env, userId) {
  const state = await getGoalWizardState(env, userId);
  if (!state || state.step !== 'confirm' || !state.data) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'หมดเวลายืนยัน',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" เพื่อเริ่มใหม่',
    }));
  }
  const result = await saveGoal(env, userId, {
    targetAmountThb: state.data.targetAmountThb,
    targetYear: state.data.targetYear,
    expectedReturnPct: state.data.expectedReturnPct,
    monthlyContributionThb: state.data.monthlyContributionThb,
    allocationTargets: state.data.allocation,
  });
  if (!result.ok) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'บันทึกเป้าหมายไม่สำเร็จ',
    }));
  }
  await deleteGoalWizardState(env, userId);
  await logEvent(env, userId, 'goal_created', {
    goal_id: result.goalId,
    target_amount_thb: state.data.targetAmountThb,
    target_year: state.data.targetYear,
    monthly_contribution_thb: state.data.monthlyContributionThb,
    expected_return_pct: state.data.expectedReturnPct,
    allocation: state.data.allocation,
  });
  // Reply with the actual goal card so user lands on the dashboard immediately.
  const goal = await getActiveGoal(env, userId);
  const netWorth = await getNetWorth(env, userId).catch(() => ({ total_thb: 0 }));
  return reply(env, ev.replyToken, goalCard({
    goal,
    netWorthThb: netWorth.total_thb,
    expectedNowThb: 0,
    contributionsTotalThb: 0,
    monthsElapsed: 0,
  }));
}

async function showGoal(ev, env, userId) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" เพื่อเริ่มต้นแผน DCA ระยะยาว',
    }));
  }
  const netWorth = await getNetWorth(env, userId).catch(() => ({ total_thb: 0 }));
  const contributionsTotalThb = await getContributionsTotal(env, userId, goal.id);
  const monthsElapsed = Math.max(0, Math.round((Date.now() / 1000 - goal.createdAt) / (60 * 60 * 24 * 30.4375)));
  const expectedNowThb = expectedFutureValue({
    pmt: goal.monthlyContributionThb,
    expectedReturnPct: goal.expectedReturnPct,
    monthsElapsed,
  });
  // Surface the CURRENT-month DCA override on the goal card so the user
  // sees the immediate effect of setting one (otherwise the goal card
  // would still show the standing amount and look "not reflected").
  const ymNow = bangkokYearMonth(new Date());
  const currentOverride = await getDcaOverride(env, userId, goal.id, ymNow);
  const goalForCard = currentOverride
    ? { ...goal, _currentOverride: { ym: ymNow, amount_thb: currentOverride.amount_thb } }
    : goal;

  // Plan-vs-actual comparison — implied return, average DCA, projected reach
  // year, and the "what would it take to get back on plan" adjustments.
  // Skip when the goal is brand new (monthsElapsed === 0) — there's no
  // history to compare against yet and the math falls back to noise.
  const monthsRemaining = Math.max(
    0,
    Math.round((Date.UTC(goal.targetYear, 0, 1) - Date.now()) / (1000 * 60 * 60 * 24 * 30.4375)),
  );
  // Always build the comparison object — for brand-new goals (monthsElapsed
  // === 0) the history-dependent fields (implied return, actual avg DCA) are
  // null and the card renders the rows we CAN compute. Most useful for a
  // fresh goal: the projected reach year given existing net worth + the
  // planned DCA, which often differs from the planned target year because
  // the user already has savings to count toward the goal.
  let comparison = null;
  if (goal && Number.isFinite(Number(goal.targetAmountThb))) {
    const actualAvgMonthlyDca = monthsElapsed > 0
      ? (Number(contributionsTotalThb) || 0) / monthsElapsed
      : null;
    const impliedReturn = monthsElapsed > 0 && Number(contributionsTotalThb) > 0
      ? impliedAnnualReturnPct({
          startValue: 0,
          contributionsTotal: contributionsTotalThb,
          currentValue: netWorth.total_thb,
          monthsElapsed,
        })
      : null;
    // For the projection, use actual pace when we have it; otherwise the
    // planned monthly. Same fallback story for the return assumption.
    const monthlyForProjection = actualAvgMonthlyDca && actualAvgMonthlyDca > 0
      ? actualAvgMonthlyDca
      : Number(goal.monthlyContributionThb);
    const returnForProjection = impliedReturn != null
      ? impliedReturn
      : Number(goal.expectedReturnPct);
    const monthsToReach = monthsToTarget({
      currentValue: netWorth.total_thb,
      monthlyContribution: monthlyForProjection,
      expectedReturnPct: returnForProjection,
      targetAmount: goal.targetAmountThb,
    });
    const projectedReachYear = monthsToReach != null
      ? (monthsToReach === 0 ? new Date().getUTCFullYear() : monthsToTargetYear(monthsToReach))
      : null;
    const yearsBehind = projectedReachYear != null
      ? projectedReachYear - goal.targetYear
      : Number.POSITIVE_INFINITY;
    const requiredMonthlyToHit = monthsRemaining > 0
      ? requiredMonthlyToTarget({
          currentValue: netWorth.total_thb,
          expectedReturnPct: goal.expectedReturnPct,
          targetAmount: goal.targetAmountThb,
          monthsRemaining,
        })
      : null;
    const requiredReturnPctToHit = monthsRemaining > 0
      ? requiredAnnualReturnPct({
          currentValue: netWorth.total_thb,
          monthlyContribution: monthlyForProjection,
          targetAmount: goal.targetAmountThb,
          monthsRemaining,
        })
      : null;

    comparison = {
      impliedReturnPct: impliedReturn,
      plannedReturnPct: Number(goal.expectedReturnPct),
      actualAvgMonthlyDca,
      plannedMonthlyDca: Number(goal.monthlyContributionThb),
      projectedReachYear,
      plannedReachYear: Number(goal.targetYear),
      yearsBehind: projectedReachYear != null ? yearsBehind : Number.POSITIVE_INFINITY,
      requiredMonthlyToHit,
      requiredReturnPctToHit,
      // Flag so the Flex side can title the panel appropriately when there's
      // no history yet ("📊 ภาพรวมแผน" instead of "🔍 เปรียบเทียบแผน vs ทำจริง").
      isNewGoal: monthsElapsed === 0,
    };
  }

  await logEvent(env, userId, 'goal_viewed', {
    goal_id: goal.id,
    net_worth_thb: Math.round(netWorth.total_thb || 0),
    expected_now_thb: Math.round(expectedNowThb || 0),
    contributions_total_thb: Math.round(contributionsTotalThb || 0),
    months_elapsed: monthsElapsed,
    has_current_override: !!currentOverride,
    implied_return_pct: comparison?.impliedReturnPct != null ? Number(comparison.impliedReturnPct.toFixed(2)) : null,
    projected_reach_year: comparison?.projectedReachYear ?? null,
    years_behind: comparison?.yearsBehind ?? null,
  });
  return reply(env, ev.replyToken, goalCard({
    goal: goalForCard,
    netWorthThb: netWorth.total_thb,
    expectedNowThb,
    contributionsTotalThb,
    monthsElapsed,
    comparison,
  }));
}

async function clearGoalHandler(ev, env, userId) {
  const ok = await clearActiveGoal(env, userId);
  if (!ok) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
    }));
  }
  await logEvent(env, userId, 'goal_cleared', null);
  return reply(env, ev.replyToken, actionAckCard({
    tone: 'info',
    title: 'ลบเป้าหมายแล้ว',
    subtitle: 'พิมพ์ "ตั้งเป้าหมาย" เพื่อเริ่มใหม่',
  }));
}

// ────────────────────────────────────────────────────────────────────────
// AIWealthOS goal — in-place edits
//
// Two entry points:
//   1. "ปรับเป้าหมาย" → menu card with 4 field buttons → postback
//      goal-edit&field=<...> → startGoalEditStep stages a one-question
//      wizard in KV → user types answer → handleGoalWizardAnswer routes
//      to the edit-mode branch → applyGoalFieldEdit patches the goal,
//      recomputes monthly_contribution_thb when amount/year/return
//      change, replies with the updated goal card.
//
//   2. Text shortcut "ปรับเป้า 30M" / "ปรับปี 2045" / "ปรับผลตอบแทน 7.5"
//      / "ปรับสัดส่วน 70 20 10" → cmd='goal-edit-field' →
//      applyGoalFieldEdit directly, no wizard.
// ────────────────────────────────────────────────────────────────────────

const EDIT_FIELD_PROMPTS = {
  amount: {
    title: '💰 ปรับยอดเป้าหมาย',
    subtitle: 'พิมพ์จำนวนเงินใหม่ — เช่น "30M" หรือ "20000000"',
  },
  horizon: {
    title: '📅 ปรับระยะเวลา',
    subtitle: 'พิมพ์ปีเป้าหมาย เช่น "2045" หรือพิมพ์จำนวนปี เช่น "20"',
  },
  return: {
    title: '📈 ปรับสมมุติผลตอบแทน',
    subtitle: 'พิมพ์ % ต่อปี เช่น "7.5"',
  },
  dca: {
    title: '💸 ปรับ DCA / เดือน',
    subtitle: 'พิมพ์จำนวนเงินต่อเดือนเอง เช่น "30000" หรือ "30K" — บอท จะใช้ตัวเลขนี้แทนค่าที่คำนวณจากเป้าหมาย',
  },
  allocation: {
    title: '🎯 ปรับสัดส่วนการลงทุน',
    subtitle: 'พิมพ์ 3 ตัวเลขรวม 100 (หุ้นไทย / ETF ตปท / เงินสด) เช่น "70 20 10"',
  },
};

async function showGoalEditMenu(ev, env, userId) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" เพื่อเริ่มต้น',
    }));
  }
  await logEvent(env, userId, 'goal_edit_menu_viewed', { goal_id: goal.id });
  return reply(env, ev.replyToken, goalEditMenuCard({ goal }));
}

async function startGoalEditStep(ev, env, userId, field) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
    }));
  }
  const normalisedField = String(field || '').replace(/^edit-/, '');
  const prompt = EDIT_FIELD_PROMPTS[normalisedField];
  if (!prompt) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'หัวข้อไม่ถูกต้อง',
    }));
  }
  // Stash an "edit" wizard in the same KV slot the create wizard uses.
  // handleGoalWizardAnswer branches on state.mode to route the answer
  // through applyGoalFieldEdit instead of advancing the create flow.
  await saveGoalWizardState(env, userId, {
    mode: 'edit',
    step: normalisedField,
    data: {},
  });
  await logEvent(env, userId, 'goal_edit_started', {
    goal_id: goal.id,
    field: normalisedField,
  });
  return reply(env, ev.replyToken, actionAckCard({
    tone: 'info',
    title: prompt.title,
    subtitle: prompt.subtitle,
    lines: [
      { text: 'พิมพ์ "ยกเลิก" เพื่อหยุด', color: '#94A3B8' },
    ],
  }));
}

// Parse + validate + patch. Shared by the menu-driven flow and the text
// shortcut. Returns the updated card or an error ack.
async function applyGoalFieldEdit(ev, env, userId, arg) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" เพื่อเริ่มต้น',
    }));
  }
  const field = arg?.field;
  const raw = String(arg?.raw || '').trim();

  let patch = null;
  let parsedValue = null;
  let humanValue = '';

  if (field === 'amount') {
    const amount = parseAmount(raw);
    const err = validateTargetAmount(amount);
    if (err) return replyEditError(ev, env, err, 'amount');
    parsedValue = amount;
    humanValue = `${amount.toLocaleString('en-US')} บาท`;
    patch = { targetAmountThb: amount };
  } else if (field === 'horizon') {
    const targetYear = parseHorizon(raw);
    const err = validateTargetYear(targetYear);
    if (err) return replyEditError(ev, env, err, 'horizon');
    parsedValue = targetYear;
    const years = targetYear - new Date().getUTCFullYear();
    humanValue = `ปี ${targetYear} (อีก ${years} ปี)`;
    patch = { targetYear };
  } else if (field === 'return') {
    const pct = Number(String(raw).replace(/[%\s]/g, ''));
    const err = validateExpectedReturn(pct);
    if (err) return replyEditError(ev, env, err, 'return');
    parsedValue = pct;
    humanValue = `${Number(pct).toFixed(1)}% / ปี`;
    patch = { expectedReturnPct: pct };
  } else if (field === 'dca') {
    // Manual DCA override — bypasses the PMT back-solver. The user is
    // saying "I'll contribute this much per month, accept the gap".
    // We don't reconcile it with target/horizon — if they're inconsistent,
    // the goal card's status badge (🟢🟡🔴) will surface that as lagging.
    const dca = parseAmount(raw);
    if (!Number.isFinite(dca) || dca <= 0) {
      return replyEditError(ev, env, 'จำนวน DCA ไม่ถูกต้อง', 'dca');
    }
    if (dca > 10_000_000) {
      return replyEditError(ev, env, 'จำนวน DCA สูงเกินไป', 'dca');
    }
    parsedValue = dca;
    humanValue = `${dca.toLocaleString('en-US')} บาท / เดือน`;
    patch = { monthlyContributionThb: dca };
  } else if (field === 'allocation') {
    const alloc = parseAllocation(raw);
    const err = alloc ? validateAllocation(alloc) : 'อ่านสัดส่วนไม่ออก';
    if (err) return replyEditError(ev, env, err, 'allocation');
    parsedValue = alloc;
    humanValue = Object.entries(alloc)
      .filter(([, v]) => Number(v) > 0)
      .map(([cls, v]) => `${cls.split('_')[0]} ${Math.round(Number(v) * 100)}%`)
      .join(' · ');
    patch = { allocationTargets: alloc };
  } else {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'หัวข้อไม่ถูกต้อง',
    }));
  }

  // Amount/year/return changes invalidate the previous monthly DCA — recompute.
  if (field === 'amount' || field === 'horizon' || field === 'return') {
    const newMonthly = solveMonthlyContribution({
      targetAmountThb: patch.targetAmountThb ?? goal.targetAmountThb,
      targetYear: patch.targetYear ?? goal.targetYear,
      expectedReturnPct: patch.expectedReturnPct ?? goal.expectedReturnPct,
    });
    patch.monthlyContributionThb = newMonthly;
  }

  const result = await updateGoalFields(env, userId, patch);
  if (!result.ok) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'แก้ไขไม่สำเร็จ',
    }));
  }

  await deleteGoalWizardState(env, userId);
  await logEvent(env, userId, 'goal_edited', {
    goal_id: result.goal.id,
    field,
    new_value: parsedValue,
    new_monthly_thb: patch.monthlyContributionThb
      ? Math.round(patch.monthlyContributionThb)
      : null,
  });

  // Build the result ack + the updated goal card together so the user sees
  // both the diff and the recomputed plan in one reply.
  const lines = [
    { label: 'หัวข้อที่แก้', value: EDIT_FIELD_PROMPTS[field].title.replace(/^.{2}\s/, '') },
    { label: 'ค่าใหม่', value: humanValue },
  ];
  if (patch.monthlyContributionThb) {
    lines.push({
      label: 'DCA ใหม่ / เดือน',
      value: `${Math.round(patch.monthlyContributionThb).toLocaleString('en-US')} บาท`,
      color: '#16A34A',
    });
  }
  const ack = actionAckCard({
    title: 'อัพเดตเป้าหมายแล้ว',
    lines,
  });

  // Re-render the goal card with the freshly-updated values too.
  const netWorth = await getNetWorth(env, userId).catch(() => ({ total_thb: 0 }));
  const monthsElapsed = Math.max(0, Math.round(
    (Date.now() / 1000 - result.goal.createdAt) / (60 * 60 * 24 * 30.4375),
  ));
  const expectedNowThb = expectedFutureValue({
    pmt: result.goal.monthlyContributionThb,
    expectedReturnPct: result.goal.expectedReturnPct,
    monthsElapsed,
  });
  const contributionsTotalThb = await getContributionsTotal(env, userId, result.goal.id);
  const updatedGoalCard = goalCard({
    goal: result.goal,
    netWorthThb: netWorth.total_thb,
    expectedNowThb,
    contributionsTotalThb,
    monthsElapsed,
  });
  return reply(env, ev.replyToken, [ack, updatedGoalCard]);
}

async function replyEditError(ev, env, err, field) {
  const prompt = EDIT_FIELD_PROMPTS[field] || {};
  return reply(env, ev.replyToken, actionAckCard({
    tone: 'warning',
    title: err,
    subtitle: prompt.subtitle || 'ลองใหม่อีกครั้ง',
  }));
}

// ────────────────────────────────────────────────────────────────────────
// Per-month DCA overrides
//
// The goal carries one standing monthly contribution. These handlers let
// the user vary that on a per-month basis ("฿80K in 2026-06 only") without
// touching the standing amount. The nudge cron + the goal-log-monthly
// postback both consult getDcaOverride() before falling back to the
// standing goal.monthlyContributionThb.
// ────────────────────────────────────────────────────────────────────────

async function startDcaOverrideWizard(ev, env, userId) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" ก่อน',
    }));
  }
  await saveGoalWizardState(env, userId, {
    mode: 'dca-override',
    step: 'month',
    data: {},
  });
  await logEvent(env, userId, 'dca_override_wizard_started', { goal_id: goal.id });
  return reply(env, ev.replyToken, actionAckCard({
    tone: 'info',
    title: '➕ ปรับ DCA เดือนใหม่',
    subtitle: 'อยากปรับ DCA สำหรับเดือนไหน?',
    lines: [
      { text: 'พิมพ์ได้หลายแบบ:', color: '#475569' },
      { text: '• "มิ.ย. 2026" หรือ "มิถุนายน 2026"', color: '#475569' },
      { text: '• "2026-06" / "06/2026"', color: '#475569' },
      { text: '• "เดือนหน้า" / "เดือนนี้"', color: '#475569' },
      { text: 'พิมพ์ "ยกเลิก" เพื่อหยุด', color: '#94A3B8' },
    ],
  }));
}

async function setDcaOverrideHandler(ev, env, userId, arg) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" ก่อน',
    }));
  }
  const amount = parseAmount(arg?.rawAmount);
  const ym = String(arg?.ym || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'จำนวน DCA ไม่ถูกต้อง',
      subtitle: 'เช่น "ปรับ DCA 80000 2026-06"',
    }));
  }
  if (!ym.match(/^\d{4}-(0[1-9]|1[0-2])$/)) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'รูปแบบเดือนไม่ถูกต้อง',
      subtitle: 'ใช้ YYYY-MM เช่น 2026-06',
    }));
  }

  const result = await setDcaOverride(env, userId, goal.id, ym, amount);
  if (!result.ok) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'บันทึก override ไม่สำเร็จ',
    }));
  }
  const diff = amount - goal.monthlyContributionThb;
  await logEvent(env, userId, 'dca_override_set', {
    goal_id: goal.id,
    year_month: ym,
    amount_thb: amount,
    diff_vs_standing: diff,
  });
  return reply(env, ev.replyToken, actionAckCard({
    title: `ตั้ง DCA เดือน ${ym} แล้ว`,
    subtitle: `บอท จะใช้ยอดนี้แทน DCA มาตรฐานในเดือนนั้น`,
    lines: [
      { label: 'เดือน', value: ym },
      { label: 'ยอดใหม่', value: `${amount.toLocaleString('en-US')} บาท` },
      { label: 'ต่างจากปกติ', value: `${diff > 0 ? '+' : ''}${diff.toLocaleString('en-US')} บาท`, color: diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#475569' },
    ],
    cta: { label: 'ดูตารางทั้งหมด', data: 'action=list-dca-overrides', displayText: 'ดูตาราง DCA' },
  }));
}

async function showDcaOverrides(ev, env, userId) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" ก่อน',
    }));
  }
  const overrides = await listDcaOverrides(env, userId, goal.id, 24);
  const currentYm = bangkokYearMonth(new Date());
  await logEvent(env, userId, 'dca_overrides_viewed', {
    goal_id: goal.id,
    override_count: overrides.length,
  });
  return reply(env, ev.replyToken, dcaOverridesCard({ goal, overrides, currentYm }));
}

async function deleteDcaOverrideHandler(ev, env, userId, arg) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ยังไม่ได้ตั้งเป้าหมาย',
    }));
  }
  const ym = String(arg?.ym || '').trim();
  if (!ym.match(/^\d{4}-\d{2}$/)) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'รูปแบบเดือนไม่ถูกต้อง',
      subtitle: 'ใช้ YYYY-MM เช่น 2026-06',
    }));
  }
  const result = await deleteDcaOverride(env, userId, goal.id, ym);
  if (!result.ok || !result.deleted) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'info',
      title: 'ไม่พบ override สำหรับเดือนนั้น',
      subtitle: `ลองตรวจสอบรายการที่ตั้งไว้ก่อนด้วย "ตาราง dca"`,
    }));
  }
  await logEvent(env, userId, 'dca_override_deleted', {
    goal_id: goal.id,
    year_month: ym,
  });
  return reply(env, ev.replyToken, actionAckCard({
    tone: 'info',
    title: `ลบ override ${ym} แล้ว`,
    subtitle: 'เดือนนั้นจะกลับมาใช้ DCA มาตรฐาน',
  }));
}

async function recordContributionHandler(ev, env, userId, arg) {
  const amount = parseAmount(arg?.amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'จำนวนเงินไม่ถูกต้อง',
      subtitle: 'เช่น "เติม 30000" หรือ "เติม 30K thai_equity"',
    }));
  }

  const goal = await getActiveGoal(env, userId);
  const goalId = goal?.id || null;

  // If user didn't specify a class, split per the goal's allocation. If no
  // goal, dump into a generic 'cash' bucket (they can re-tag later).
  const explicitClass = arg?.assetClass;
  if (explicitClass) {
    if (!isValidClass(explicitClass)) {
      return reply(env, ev.replyToken, actionAckCard({
        tone: 'warning',
        title: 'ประเภทสินทรัพย์ไม่ถูกต้อง',
        subtitle: `เลือกจาก: ${Object.keys(ASSET_CLASSES).join(', ')}`,
      }));
    }
    const res = await recordContribution(env, userId, {
      goalId,
      assetClass: explicitClass,
      amountThb: amount,
      notes: null,
    });
    if (!res.ok) return reply(env, ev.replyToken, actionAckCard({ tone: 'warning', title: 'บันทึกไม่สำเร็จ' }));
    await logEvent(env, userId, 'contribution_recorded', {
      goal_id: goalId, amount_thb: amount, asset_class: explicitClass,
    });
    const meta = ASSET_CLASSES[explicitClass];
    return reply(env, ev.replyToken, actionAckCard({
      title: `บันทึก ${amount.toLocaleString('en-US')} บาท`,
      subtitle: `${meta.emoji} ${meta.label}`,
      lines: goal ? [{ label: 'รวม DCA สะสม', value: `${(await getContributionsTotal(env, userId, goalId)).toLocaleString('en-US')} บาท` }] : [],
    }));
  }

  // Split across allocation
  const allocation = goal?.allocationTargets || DEFAULT_ALLOCATION;
  const totalWeight = Object.values(allocation).reduce((s, v) => s + Number(v || 0), 0) || 1;
  const lines = [];
  for (const [cls, weight] of Object.entries(allocation)) {
    const w = Number(weight) || 0;
    if (w <= 0) continue;
    const slice = amount * (w / totalWeight);
    await recordContribution(env, userId, {
      goalId, assetClass: cls, amountThb: slice, notes: 'auto-split',
    });
    const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
    lines.push({ label: `${meta.emoji} ${meta.label}`, value: `${Math.round(slice).toLocaleString('en-US')} บาท` });
  }
  await logEvent(env, userId, 'contribution_recorded', {
    goal_id: goalId, amount_thb: amount, asset_class: 'auto-split',
    allocation,
  });
  return reply(env, ev.replyToken, actionAckCard({
    title: `บันทึก ${amount.toLocaleString('en-US')} บาท`,
    subtitle: goal ? `แบ่งตามแผน DCA` : 'ยังไม่มีเป้าหมาย — แบ่งตาม default 60/30/10',
    lines,
  }));
}

async function logGoalMonthlyContribution(ev, env, userId) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'ยังไม่มีเป้าหมาย',
      subtitle: 'พิมพ์ "ตั้งเป้าหมาย" เพื่อตั้ง',
    }));
  }
  // Check for a per-month override for THIS calendar month (Bangkok). If set,
  // suggest that amount; otherwise fall back to the standing monthly DCA.
  const ym = bangkokYearMonth(new Date());
  const override = await getDcaOverride(env, userId, goal.id, ym);
  const monthly = override?.amount_thb ?? goal.monthlyContributionThb;
  return recordContributionHandler(ev, env, userId, {
    amountRaw: String(Math.round(monthly)),
    assetClass: null,
  });
}

// AIWealthOS Phase 2 — daily nudge cron.
//
// Iterates every user with an active goal, asks evaluateUserNudges() what
// (if anything) should fire RIGHT NOW, pushes the corresponding Flex card,
// and marks the KV throttle. Behavior intentionally split:
//   - Drift detection runs daily; at most once per user per 7 days.
//   - DCA reminder fires only on DCA_REMINDER_DOM (default: 1st of month
//     in Asia/Bangkok); at most once per user per calendar month.
//
// Call with { force: true } via /test-nudges?force=1 to bypass throttles.
async function runNudgesCron(env, { force = false } = {}) {
  const startedAt = new Date().toISOString();
  const result = {
    startedAt,
    candidates: 0,
    drift_sent: 0,
    drift_skipped_throttled: 0,
    drift_skipped_under_threshold: 0,
    dca_sent: 0,
    dca_skipped_throttled: 0,
    dca_skipped_off_day: 0,
    errors: [],
  };

  try {
    const userIds = await getUsersWithActiveGoals(env);
    result.candidates = userIds.length;

    for (const userId of userIds) {
      try {
        const dec = await evaluateUserNudges(env, userId, { force });
        if (dec.skipReason) continue;

        // Drift nudge
        if (dec.drift) {
          const ok = await push(env, userId, driftNudgeCard({
            driftReport: dec.drift.report,
            goal: dec.goal,
          }));
          if (ok) {
            if (!force) await markDriftSent(env, dec.drift.key);
            result.drift_sent++;
            await logEvent(env, userId, 'drift_nudge_sent', {
              goal_id: dec.goal.id,
              max_drift_pp: Math.round(dec.drift.report.maxDriftPP),
              overweight: dec.drift.report.overweight?.class || null,
              underweight: dec.drift.report.underweight?.class || null,
              forced: !!force,
            });
          }
        } else if (dec.driftSkippedThrottled) {
          result.drift_skipped_throttled++;
        } else {
          result.drift_skipped_under_threshold++;
        }

        // Monthly DCA reminder — check for a per-month override first so
        // the reminder suggests the user's customised amount (e.g. bonus
        // month) instead of the standing monthly contribution.
        if (dec.dca) {
          const override = await getDcaOverride(env, userId, dec.goal.id, dec.dca.ym);
          const monthlyForCard = override?.amount_thb ?? dec.goal.monthlyContributionThb;
          const goalForCard = override?.amount_thb != null
            ? { ...dec.goal, monthlyContributionThb: monthlyForCard }
            : dec.goal;
          const ok = await push(env, userId, dcaReminderCard({
            goal: goalForCard,
            ym: dec.dca.ym,
            holdingsCount: (dec.netWorth.breakdown || []).length,
          }));
          if (ok) {
            if (!force) await markDcaSent(env, dec.dca.key);
            result.dca_sent++;
            await logEvent(env, userId, 'dca_reminder_sent', {
              goal_id: dec.goal.id,
              ym: dec.dca.ym,
              override_used: override?.amount_thb != null,
              monthly_thb: Math.round(dec.goal.monthlyContributionThb),
              forced: !!force,
            });
          }
        } else if (dec.dcaSkippedThrottled) {
          result.dca_skipped_throttled++;
        } else {
          result.dca_skipped_off_day++;
        }
      } catch (perUserErr) {
        const msg = String(perUserErr?.message || perUserErr).slice(0, 200);
        result.errors.push({ userId, error: msg });
      }
    }
  } catch (err) {
    result.fatal = String(err?.message || err).slice(0, 300);
    console.error('nudges cron error', err);
  } finally {
    result.finishedAt = new Date().toISOString();
    await env.SESSION_KV.put(
      'nudges:last-run',
      JSON.stringify(result),
      { expirationTtl: 60 * 60 * 24 * 7 },
    );
  }
}

// AIWealthOS Phase 2 (cont.) — weekly Sunday goal-status digest.
//
// Distinct from runNudgesCron (which is behavior-prompting). This is a quiet
// retrospective: "here's where you stand vs the plan this week". Fires once
// per ISO week per user.
async function runWeeklyStatusCron(env, { force = false } = {}) {
  const startedAt = new Date().toISOString();
  const result = {
    startedAt,
    candidates: 0,
    sent: 0,
    skipped_throttled: 0,
    skipped_no_goal: 0,
    errors: [],
  };

  try {
    const userIds = await getUsersWithActiveGoals(env);
    result.candidates = userIds.length;
    const now = new Date();
    const weekToken = bangkokWeekToken(now);
    const { startIso, endIso } = bangkokWeekRange(now);

    for (const userId of userIds) {
      try {
        const goal = await getActiveGoal(env, userId);
        if (!goal) { result.skipped_no_goal++; continue; }

        const key = `nudges:weekly:${userId}:${weekToken}`;
        if (!force) {
          const already = await env.SESSION_KV.get(key);
          if (already) { result.skipped_throttled++; continue; }
        }

        const netWorth = await getNetWorth(env, userId);
        const contributionsTotalThb = await getContributionsTotal(env, userId, goal.id);
        const contributionsThisMonthThb = await getContributionsThisMonth(env, userId, goal.id, now);
        const monthsElapsed = Math.max(0, Math.round(
          (Date.now() / 1000 - goal.createdAt) / (60 * 60 * 24 * 30.4375),
        ));
        const expectedNowThb = expectedFutureValue({
          pmt: goal.monthlyContributionThb,
          expectedReturnPct: goal.expectedReturnPct,
          monthsElapsed,
        });
        const driftReport = computeDrift(netWorth, goal.allocationTargets);
        const topClass = driftReport?.overweight || null;
        const bottomClass = driftReport?.underweight || null;

        const ok = await push(env, userId, weeklyStatusCard({
          goal,
          netWorthThb: netWorth.total_thb,
          expectedNowThb,
          contributionsTotalThb,
          contributionsThisMonthThb,
          monthsElapsed,
          topClass,
          bottomClass,
          weekStartIso: startIso,
          weekEndIso: endIso,
        }));

        if (ok) {
          if (!force) await markWeeklySent(env, key);
          result.sent++;
          await logEvent(env, userId, 'weekly_status_sent', {
            goal_id: goal.id,
            week: weekToken,
            net_worth_thb: Math.round(netWorth.total_thb || 0),
            expected_now_thb: Math.round(expectedNowThb || 0),
            contributions_this_month_thb: Math.round(contributionsThisMonthThb || 0),
            max_drift_pp: driftReport ? Math.round(driftReport.maxDriftPP) : 0,
            forced: !!force,
          });
        }
      } catch (perUserErr) {
        result.errors.push({
          userId,
          error: String(perUserErr?.message || perUserErr).slice(0, 200),
        });
      }
    }
  } catch (err) {
    result.fatal = String(err?.message || err).slice(0, 300);
    console.error('weekly status cron error', err);
  } finally {
    result.finishedAt = new Date().toISOString();
    await env.SESSION_KV.put(
      'weekly:last-run',
      JSON.stringify(result),
      { expirationTtl: 60 * 60 * 24 * 14 },
    );
  }
}

// ────────────────────────────────────────────────────────────────────────
// AIWealthOS Phase 3 — dividend ledger handlers
// ────────────────────────────────────────────────────────────────────────

async function recordDividendHandler(ev, env, userId, arg) {
  const symbol = String(arg?.symbol || '').toUpperCase();
  // Two number-input modes:
  //   ปันผล PTT 2150               → amount = 2150 (one num)
  //   ปันผล PTT 2.15 @ 1000         → per_share=2.15, qty=1000, amount=2150 (two nums)
  const firstNum = Number(String(arg?.firstNum || '').replace(/,/g, ''));
  const secondNum = arg?.secondNum != null ? Number(String(arg.secondNum).replace(/,/g, '')) : null;
  let amountThb, perShare = null, quantity = null;
  if (Number.isFinite(secondNum) && secondNum > 0) {
    perShare = firstNum;
    quantity = secondNum;
    amountThb = firstNum * secondNum;
  } else {
    amountThb = firstNum;
  }

  if (!Number.isFinite(amountThb) || amountThb <= 0) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'จำนวนปันผลไม่ถูกต้อง',
      subtitle: 'เช่น "ปันผล PTT 2150" หรือ "ปันผล PTT 2.15 1000"',
    }));
  }

  const active = await getActivePortfolio(env, userId).catch(() => null);
  const result = await recordDividend(env, userId, {
    portfolioId: active?.portfolio?.id || null,
    symbol,
    amountThb,
    perShare,
    quantity,
  });
  if (!result.ok) {
    return reply(env, ev.replyToken, actionAckCard({
      tone: 'warning',
      title: 'บันทึกปันผลไม่สำเร็จ',
    }));
  }
  const goal = await getActiveGoal(env, userId).catch(() => null);
  await logEvent(env, userId, 'dividend_recorded', {
    dividend_id: result.dividendId,
    symbol,
    amount_thb: amountThb,
    per_share: perShare,
    quantity,
    portfolio_id: active?.portfolio?.id || null,
  });
  return reply(env, ev.replyToken, dividendConfirmCard({
    result: { ...result, perShare, quantity },
    hasActiveGoal: !!goal,
  }));
}

async function showDividendsList(ev, env, userId) {
  const [dividends, ytd, allTimeTotal] = await Promise.all([
    listDividends(env, userId, 20),
    getDividendsYtd(env, userId),
    getDividendsTotalAllTime(env, userId),
  ]);
  await logEvent(env, userId, 'dividends_viewed', {
    count: dividends.length,
    ytd_total_thb: Math.round(ytd.total || 0),
    all_time_thb: Math.round(allTimeTotal || 0),
  });
  return reply(env, ev.replyToken, dividendsListCard({ dividends, ytd, allTimeTotal }));
}

// ────────────────────────────────────────────────────────────────────────
// AIWealthOS Phase 4 — LEARN module handlers
// ────────────────────────────────────────────────────────────────────────

async function showTopicList(ev, env, userId) {
  const groups = listTopicsByCategory();
  await logEvent(env, userId, 'topic_list_viewed', {
    total_topics: groups.reduce((s, g) => s + g.topics.length, 0),
  });
  return reply(env, ev.replyToken, topicListCard(groups));
}

async function explainTopicHandler(ev, env, userId, arg) {
  const query = String(arg?.query || '').trim();
  if (!query) {
    return showTopicList(ev, env, userId);
  }

  // Static topic first — zero AI latency, no hallucination risk.
  const topic = findTopic(query);
  if (topic) {
    await logEvent(env, userId, 'topic_explained', {
      query,
      matched: topic.key,
      source: 'static',
    });
    return reply(env, ev.replyToken, topicCard(topic));
  }

  // Fallback: Claude contextual explainer using user's current holdings.
  await showLoading(env, userId, 20);
  let active = null;
  try {
    active = await getActivePortfolio(env, userId);
  } catch (_) {
    // ignore — explainer works without portfolio context too
  }
  let answer;
  try {
    answer = await generateContextualExplainer(env, query, active?.holdings || []);
  } catch (err) {
    console.error('explainer error', err);
    await logEvent(env, userId, 'topic_explained_failed', {
      query,
      error: String(err?.message || err).slice(0, 200),
    });
    return push(env, userId, actionAckCard({
      tone: 'warning',
      title: 'ตอบไม่ทันตอนนี้',
      subtitle: 'ลองใหม่อีกครั้งนะ หรือพิมพ์ "อธิบาย" เพื่อดูหัวข้อในห้องสมุด',
    }));
  }

  await logEvent(env, userId, 'topic_explained', {
    query,
    matched: null,
    source: 'ai',
    answer_chars: (answer || '').length,
  });
  return push(env, userId, aiExplainerCard({ query, answer: answer || '— ไม่มีคำตอบ —' }));
}

async function runFxCron(env) {
  const startedAt = new Date().toISOString();
  let stored = [];
  let error = null;
  try {
    stored = await fetchAndStoreFxRates(env);
  } catch (err) {
    error = String(err?.message || err);
    console.error('fx cron error', err);
  } finally {
    await env.SESSION_KV.put(
      'fx:last-run',
      JSON.stringify({
        startedAt,
        finishedAt: new Date().toISOString(),
        stored,
        error,
      }),
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
