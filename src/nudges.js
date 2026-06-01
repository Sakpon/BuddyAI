// AIWealthOS Phase 2 — the ACT module's nudge engine.
//
// Two scheduled triggers, both gated by KV throttles so we never spam:
//   1. Drift detection — daily check vs goal allocation, nudge if a class
//      strays more than DRIFT_THRESHOLD_PP percentage points from target.
//      Throttle: at most one drift nudge per user per 7 days.
//   2. DCA monthly reminder — on the user's DCA day (default: 1st of month
//      in Asia/Bangkok), push a "DCA due ฿X" Flex with a one-tap log button.
//      Throttle: at most one reminder per user per calendar month.
//
// The cron path calls runNudges(env, { force: false }) once a day. The
// implementation no-ops cheaply when neither trigger fires for a user.

import { ASSET_CLASSES } from './assetclass.js';
import { getActiveGoal, logEvent } from './db.js';
import { getNetWorth } from './wealth.js';

export const DRIFT_THRESHOLD_PP = 5;       // percentage points
export const DCA_REMINDER_DOM = 1;          // day-of-month, Asia/Bangkok
const DRIFT_THROTTLE_SECONDS = 60 * 60 * 24 * 7;
const DCA_THROTTLE_SECONDS = 60 * 60 * 24 * 35;

// Compute per-class drift between current net-worth allocation and the
// goal's target allocation. Returns sorted by absolute drift desc.
//
//   netWorth.breakdown[i] = { class, pct, value_thb, ... } where pct is 0-100
//   targetAllocation       = { thai_equity: 0.6, global_etf: 0.3, ... } in 0-1
export function computeDrift(netWorth, targetAllocation) {
  const total = Number(netWorth?.total_thb) || 0;
  if (total <= 0 || !targetAllocation) return null;

  const breakdownByClass = new Map();
  for (const b of (netWorth.breakdown || [])) {
    breakdownByClass.set(b.class, b);
  }

  const drifts = [];
  // Walk both the target allocation and any extra classes the user actually
  // holds (e.g. they have a hk_equity bucket but no target for it — that's
  // still drift).
  const allClasses = new Set([
    ...Object.keys(targetAllocation),
    ...breakdownByClass.keys(),
  ]);
  for (const cls of allClasses) {
    const targetPct = (Number(targetAllocation[cls]) || 0) * 100;
    const currentPct = Number(breakdownByClass.get(cls)?.pct || 0);
    drifts.push({
      class: cls,
      currentPct,
      targetPct,
      driftPP: currentPct - targetPct,
    });
  }
  drifts.sort((a, b) => Math.abs(b.driftPP) - Math.abs(a.driftPP));

  const maxDriftPP = drifts.length ? Math.abs(drifts[0].driftPP) : 0;
  return {
    drifts,
    maxDriftPP,
    overweight: drifts.find((d) => d.driftPP > 0) || null,
    underweight: drifts.find((d) => d.driftPP < 0) || null,
  };
}

// Returns true if the drift profile warrants a nudge. Conservative — only
// fires above the threshold AND when there's a meaningful underweight to
// suggest topping up.
export function shouldNudgeDrift(driftReport, thresholdPP = DRIFT_THRESHOLD_PP) {
  if (!driftReport) return false;
  if (driftReport.maxDriftPP < thresholdPP) return false;
  // Need at least one underweight class for the "เติมไปทาง X" suggestion to
  // make sense. If everything is overweight (rare — user added cash and now
  // every class is below target) we still nudge to surface the imbalance.
  return true;
}

// Bangkok-time DOM. Used to gate the DCA monthly reminder.
export function bangkokDayOfMonth(now = new Date()) {
  // Cloudflare Workers run in UTC; offset to Asia/Bangkok (+7).
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  return new Date(bkkMs).getUTCDate();
}

export function bangkokYearMonth(now = new Date()) {
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(bkkMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Per-user gate — returns the nudges this user should receive RIGHT NOW.
// Centralizes the throttle + match-criteria logic so the cron and the
// per-user "/test-nudge?userId=..." debug endpoint share behavior.
export async function evaluateUserNudges(env, userId, { force = false, now = new Date() } = {}) {
  const goal = await getActiveGoal(env, userId);
  if (!goal) return { skipReason: 'no_active_goal' };

  const netWorth = await getNetWorth(env, userId);
  const decisions = { goal, netWorth };

  // Drift
  const driftKey = `nudge:drift:${userId}`;
  const driftThrottle = !force ? await env.SESSION_KV.get(driftKey) : null;
  if (!driftThrottle) {
    const driftReport = computeDrift(netWorth, goal.allocationTargets);
    if (shouldNudgeDrift(driftReport)) {
      decisions.drift = { report: driftReport, key: driftKey };
    }
  } else {
    decisions.driftSkippedThrottled = true;
  }

  // DCA monthly reminder — only on the user's chosen day (currently fixed
  // to DCA_REMINDER_DOM = 1).
  const dom = bangkokDayOfMonth(now);
  if (force || dom === DCA_REMINDER_DOM) {
    const ym = bangkokYearMonth(now);
    const dcaKey = `nudge:dca:${userId}:${ym}`;
    const dcaThrottle = !force ? await env.SESSION_KV.get(dcaKey) : null;
    if (!dcaThrottle) {
      decisions.dca = { ym, key: dcaKey };
    } else {
      decisions.dcaSkippedThrottled = true;
    }
  }

  return decisions;
}

// Mark a nudge as sent so the throttle holds. Called by the caller after
// the push succeeds.
export async function markDriftSent(env, key) {
  await env.SESSION_KV.put(key, String(Date.now()), { expirationTtl: DRIFT_THROTTLE_SECONDS });
}
export async function markDcaSent(env, key) {
  await env.SESSION_KV.put(key, String(Date.now()), { expirationTtl: DCA_THROTTLE_SECONDS });
}

// Bangkok ISO-8601 week token "YYYY-WW" — used as the weekly status
// throttle key so each user receives at most one weekly digest per ISO week.
export function bangkokWeekToken(now = new Date()) {
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(bkkMs);
  // ISO week: Thursday-of-week defines the year + week number.
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Range strings for the digest header.
export function bangkokWeekRange(now = new Date()) {
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(bkkMs);
  d.setUTCHours(0, 0, 0, 0);
  // Sunday-start week (the cron runs on Sunday, so "this week" reads as
  // Sun → Sat for most users).
  const dow = d.getUTCDay(); // 0=Sun
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - dow);
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  return { startIso: sunday.toISOString(), endIso: saturday.toISOString() };
}

export const WEEKLY_STATUS_THROTTLE_SECONDS = 60 * 60 * 24 * 14;

export async function markWeeklySent(env, key) {
  await env.SESSION_KV.put(key, String(Date.now()), { expirationTtl: WEEKLY_STATUS_THROTTLE_SECONDS });
}

// Human-readable label for an asset class (defensive: falls back to the
// raw class string if the taxonomy doesn't know about it).
export function classLabel(cls) {
  return ASSET_CLASSES[cls]?.label || cls || 'อื่นๆ';
}
