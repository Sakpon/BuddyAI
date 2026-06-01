// Goal math — compound-interest back-solver for DCA contributions.
//
// Given a target THB amount, a horizon in months, and an expected annualized
// return, solve for the monthly contribution (PMT) needed to hit the target.
// Then expose the forward-looking "where should you be by now" calculation
// so the goal card can show on-track / off-track status.

const MIN_RETURN_PCT = -10;
const MAX_RETURN_PCT = 30;
const MIN_TARGET_AMOUNT = 1000;        // ฿1k floor — anything smaller is a savings goal not an investing one
const MAX_TARGET_AMOUNT = 1_000_000_000; // ฿1B ceiling — beyond this, get a private banker

// Default annual return — middle of "60/30/10 Thai/global/cash" historical
// real returns, rounded to a number that's defensible and easy to remember.
export const DEFAULT_EXPECTED_RETURN_PCT = 6.5;

// Default 60/30/10 allocation from the deck.
export const DEFAULT_ALLOCATION = {
  thai_equity: 0.6,
  global_etf:  0.3,
  cash:        0.1,
};

// PMT = FV × r / ((1+r)^n - 1)
//   FV = target_amount_thb
//   r  = monthly rate = expected_return_pct / 100 / 12
//   n  = months from now to target_year
export function solveMonthlyContribution({ targetAmountThb, targetYear, expectedReturnPct = DEFAULT_EXPECTED_RETURN_PCT, currentMonths = monthsUntil(targetYear) }) {
  const fv = Number(targetAmountThb);
  const n = Math.max(1, Number(currentMonths));
  const r = (Number(expectedReturnPct) / 100) / 12;
  if (!Number.isFinite(fv) || !Number.isFinite(n) || !Number.isFinite(r)) return null;
  if (r === 0) return fv / n;
  return fv * r / (Math.pow(1 + r, n) - 1);
}

// Where you SHOULD be by month t, assuming you'd been contributing PMT/month
// since goal creation. Used to decide on-track / lagging / off-track.
//   FV(t) = PMT × ((1+r)^t - 1) / r
export function expectedFutureValue({ pmt, expectedReturnPct, monthsElapsed }) {
  const t = Math.max(0, Number(monthsElapsed));
  const r = (Number(expectedReturnPct) / 100) / 12;
  if (!Number.isFinite(t) || !Number.isFinite(r)) return null;
  if (r === 0) return Number(pmt) * t;
  return Number(pmt) * (Math.pow(1 + r, t) - 1) / r;
}

// Months between now and Jan 1 of the target year. We measure to the start of
// the target year so "20M by 2040" means "have 20M in hand on Jan 1 2040",
// matching how Thai investors typically frame goals.
export function monthsUntil(targetYear) {
  const now = new Date();
  const target = new Date(Date.UTC(Number(targetYear), 0, 1));
  const diffMs = target.getTime() - now.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
}

// ──────────────────────────────────────────────────────────────────────────
// Plan-vs-actual analytics — used by the goal card's comparison section.
//
// These are deliberately approximations, not full MWRR/IRR Newton-Raphson
// solves. The user is comparing "how is my plan doing" not preparing tax
// filings, so a closed-form simplification (treats contributions as evenly
// distributed) keeps the math fast and the explanations intuitive.
// ──────────────────────────────────────────────────────────────────────────

// Implied annualised return given start + contributions + current value.
// Simplified MWRR-like: assumes contributions arrived evenly across the
// elapsed period, so avgInvested = startValue + contributionsTotal / 2.
// Good enough for the "ผลตอบแทนที่ทำได้จริง" comparison.
export function impliedAnnualReturnPct({ startValue, contributionsTotal, currentValue, monthsElapsed }) {
  const months = Number(monthsElapsed) || 0;
  if (months <= 0) return null;
  const years = months / 12;
  const start = Number(startValue) || 0;
  const contribs = Number(contributionsTotal) || 0;
  const cur = Number(currentValue) || 0;
  const avgInvested = start + contribs / 2;
  if (avgInvested <= 0) return null;
  const totalGain = cur - start - contribs;
  return (totalGain / avgInvested) / years * 100;
}

// How many months until current trajectory reaches the target?
//   FV(t) = PV*(1+r)^t + PMT * ((1+r)^t - 1)/r
//   Set FV = TARGET, solve for t:
//     (1+r)^t = (TARGET*r + PMT) / (PV*r + PMT)
//     t       = log(...) / log(1+r)
// Returns null when current PMT + return path mathematically can't reach
// the target (e.g. PMT too small even with infinite time).
export function monthsToTarget({ currentValue, monthlyContribution, expectedReturnPct, targetAmount }) {
  const PV = Number(currentValue) || 0;
  const PMT = Number(monthlyContribution) || 0;
  const TARGET = Number(targetAmount) || 0;
  const r = (Number(expectedReturnPct) / 100) / 12;
  if (PV >= TARGET) return 0;
  if (PMT <= 0 && r <= 0) return null;
  if (r === 0) return Math.ceil((TARGET - PV) / Math.max(1, PMT));
  const numer = TARGET * r + PMT;
  const denom = PV * r + PMT;
  if (denom <= 0 || numer <= 0) return null;
  const ratio = numer / denom;
  if (ratio <= 1) return null;
  return Math.ceil(Math.log(ratio) / Math.log(1 + r));
}

// What monthly DCA does the user need NOW (with current PV) to still hit the
// original target year? Reverse of solveMonthlyContribution but accounting
// for current value as the new "starting point".
//
//   FV  = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
//   PMT = (FV - PV*(1+r)^n) * r / ((1+r)^n - 1)
export function requiredMonthlyToTarget({ currentValue, expectedReturnPct, targetAmount, monthsRemaining }) {
  const PV = Number(currentValue) || 0;
  const TARGET = Number(targetAmount) || 0;
  const n = Math.max(1, Number(monthsRemaining));
  const r = (Number(expectedReturnPct) / 100) / 12;
  if (r === 0) return Math.max(0, (TARGET - PV) / n);
  const growth = Math.pow(1 + r, n);
  const futurePV = PV * growth;
  if (futurePV >= TARGET) return 0;
  return (TARGET - futurePV) * r / (growth - 1);
}

// What annual return does the user need (with current PV + current PMT) to
// hit the original target year? Bisection — the closed-form is ugly because
// r appears both as base and exponent and we'd need Lambert W to invert it.
export function requiredAnnualReturnPct({ currentValue, monthlyContribution, targetAmount, monthsRemaining }) {
  const PV = Number(currentValue) || 0;
  const PMT = Number(monthlyContribution) || 0;
  const TARGET = Number(targetAmount) || 0;
  const n = Math.max(1, Number(monthsRemaining));

  const fvAt = (annualPct) => {
    const r = (annualPct / 100) / 12;
    if (Math.abs(r) < 1e-10) return PV + PMT * n;
    return PV * Math.pow(1 + r, n) + PMT * (Math.pow(1 + r, n) - 1) / r;
  };

  let lo = -20, hi = 50;
  if (fvAt(hi) < TARGET) return null;          // even 50% can't bridge it
  if (fvAt(lo) > TARGET) return null;          // even -20% would overshoot (unusual)
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (fvAt(mid) > TARGET) hi = mid;
    else lo = mid;
    if (hi - lo < 0.01) break;
  }
  return (lo + hi) / 2;
}

// Convert a months count into the target calendar year (Asia/Bangkok ceiling).
// Used to render "คาดการณ์ปี 2043" alongside the planned 2041.
export function monthsToTargetYear(months, now = new Date()) {
  if (!Number.isFinite(months) || months < 0) return null;
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(bkkMs);
  const reachMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.ceil(months), 1);
  return new Date(reachMs).getUTCFullYear();
}

// Validation — returns null if input is sane, otherwise an error string.
export function validateTargetAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'ระบุจำนวนเงินเป็นตัวเลข';
  if (n < MIN_TARGET_AMOUNT) return `จำนวนน้อยเกินไป (ขั้นต่ำ ${MIN_TARGET_AMOUNT.toLocaleString('en-US')} บาท)`;
  if (n > MAX_TARGET_AMOUNT) return 'จำนวนสูงเกินไป';
  return null;
}

export function validateTargetYear(year) {
  const y = Number(year);
  const now = new Date().getUTCFullYear();
  if (!Number.isInteger(y)) return 'ระบุปีเป้าหมายเป็นตัวเลข';
  if (y <= now) return 'ปีเป้าหมายต้องเป็นอนาคต';
  if (y > now + 60) return 'ระยะเวลายาวเกินไป (มากสุด 60 ปี)';
  return null;
}

export function validateAllocation(allocMap) {
  if (!allocMap || typeof allocMap !== 'object') return 'รูปแบบสัดส่วนไม่ถูกต้อง';
  const sum = Object.values(allocMap).reduce((s, v) => s + Number(v || 0), 0);
  if (Math.abs(sum - 1) > 0.01) return `สัดส่วนต้องรวมเป็น 100% (ตอนนี้ ${Math.round(sum * 100)}%)`;
  for (const v of Object.values(allocMap)) {
    if (!Number.isFinite(Number(v)) || Number(v) < 0) return 'สัดส่วนต้องไม่ติดลบ';
  }
  return null;
}

export function validateExpectedReturn(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return 'ระบุผลตอบแทนเป็นตัวเลข';
  if (n < MIN_RETURN_PCT || n > MAX_RETURN_PCT) return `ผลตอบแทนต้องอยู่ระหว่าง ${MIN_RETURN_PCT}% ถึง ${MAX_RETURN_PCT}%`;
  return null;
}

// Parse user input shortcuts:
//   "20M"     → 20_000_000
//   "20m"     → 20_000_000
//   "5K"      → 5_000
//   "1.5M"    → 1_500_000
//   "1000000" → 1_000_000
//   "1,000,000" → 1_000_000
export function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/,/g, '').toUpperCase();
  let mul = 1;
  if (s.endsWith('M')) { mul = 1_000_000; s = s.slice(0, -1); }
  else if (s.endsWith('K')) { mul = 1_000; s = s.slice(0, -1); }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n * mul;
}

// Parse the horizon answer:
//   "15"   → target year = now + 15
//   "2040" → target year = 2040
export function parseHorizon(raw) {
  const n = Number(String(raw || '').trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  const now = new Date().getUTCFullYear();
  if (n > now) return n;          // it's a year
  return now + n;                  // it's a number of years
}

// Normalise a month string into "YYYY-MM" (Asia/Bangkok).
//
// Accepted inputs (case-insensitive, trim-tolerant):
//   "2026-06"            → "2026-06"
//   "2026/06" "06/2026"  → "2026-06"
//   "06-2026"            → "2026-06"
//   "มิ.ย. 2026" "มิย 2026" "มิถุนายน 2026" → "2026-06"
//   "jun 2026" "june 2026" "Jun 2026"        → "2026-06"
//   "เดือนหน้า" "next month" → "<next BKK month>"
//   "เดือนนี้" "this month"   → "<current BKK month>"
//
// Returns null on unrecognised input.
export function parseYearMonth(raw, now = new Date()) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;

  // Relative shortcuts — Bangkok-time
  const bkkNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const bkkYear = bkkNow.getUTCFullYear();
  const bkkMonth = bkkNow.getUTCMonth() + 1; // 1-12

  if (['เดือนนี้', 'this month', 'this-month', 'current'].includes(s)) {
    return `${bkkYear}-${String(bkkMonth).padStart(2, '0')}`;
  }
  if (['เดือนหน้า', 'next month', 'next-month'].includes(s)) {
    const next = bkkMonth === 12 ? 1 : bkkMonth + 1;
    const nextYear = bkkMonth === 12 ? bkkYear + 1 : bkkYear;
    return `${nextYear}-${String(next).padStart(2, '0')}`;
  }
  if (['เดือนที่แล้ว', 'last month', 'previous month'].includes(s)) {
    const prev = bkkMonth === 1 ? 12 : bkkMonth - 1;
    const prevYear = bkkMonth === 1 ? bkkYear - 1 : bkkYear;
    return `${prevYear}-${String(prev).padStart(2, '0')}`;
  }

  // Strict YYYY-MM or YYYY/MM
  let m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return canonical(Number(m[1]), Number(m[2]));

  // MM-YYYY or MM/YYYY
  m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return canonical(Number(m[2]), Number(m[1]));

  // Month-name + year — Thai or English. Year defaults to current Bangkok
  // year if the user typed only the month name.
  const monthIdx = parseMonthName(s.split(/[\s.]+/)[0]);
  let yearTok = null;
  if (monthIdx != null) {
    const tokens = s.split(/[\s.]+/).filter(Boolean);
    for (const tok of tokens) {
      const y = Number(tok);
      if (Number.isInteger(y) && y >= 2000 && y <= 2100) { yearTok = y; break; }
      // Buddhist Era → CE
      if (Number.isInteger(y) && y >= 2500 && y <= 2700) { yearTok = y - 543; break; }
    }
    return canonical(yearTok || bkkYear, monthIdx);
  }

  // Try "<year-name> <month-name>" order too (e.g. "2026 มิ.ย.")
  const tokens = s.split(/[\s.]+/).filter(Boolean);
  for (const tok of tokens) {
    const idx = parseMonthName(tok);
    if (idx != null) {
      for (const tok2 of tokens) {
        const y = Number(tok2);
        if (Number.isInteger(y) && y >= 2000 && y <= 2100) return canonical(y, idx);
        if (Number.isInteger(y) && y >= 2500 && y <= 2700) return canonical(y - 543, idx);
      }
      return canonical(bkkYear, idx);
    }
  }

  return null;
}

function canonical(year, month) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

const THAI_MONTH_ALIASES = {
  มกราคม: 1,    มกรา: 1,    มกร: 1,    มค: 1,    'ม.ค': 1,    'ม.ค.': 1,
  กุมภาพันธ์: 2, กุมภา: 2,   กพ: 2,     'ก.พ': 2,  'ก.พ.': 2,
  มีนาคม: 3,    มีนา: 3,    มีค: 3,    'มี.ค': 3, 'มี.ค.': 3,
  เมษายน: 4,    เมษา: 4,    เมย: 4,    'เม.ย': 4, 'เม.ย.': 4,
  พฤษภาคม: 5,   พฤษภา: 5,   พค: 5,     'พ.ค': 5,  'พ.ค.': 5,
  มิถุนายน: 6,  มิถุนา: 6,  มิย: 6,    'มิ.ย': 6, 'มิ.ย.': 6,
  กรกฎาคม: 7,   กรกฎา: 7,   กค: 7,     'ก.ค': 7,  'ก.ค.': 7,
  สิงหาคม: 8,   สิงหา: 8,   สค: 8,     'ส.ค': 8,  'ส.ค.': 8,
  กันยายน: 9,   กันยา: 9,   กย: 9,     'ก.ย': 9,  'ก.ย.': 9,
  ตุลาคม: 10,   ตุลา: 10,   ตค: 10,    'ต.ค': 10, 'ต.ค.': 10,
  พฤศจิกายน: 11, พฤศจิกา: 11, พย: 11,  'พ.ย': 11, 'พ.ย.': 11,
  ธันวาคม: 12,  ธันวา: 12,  ธค: 12,    'ธ.ค': 12, 'ธ.ค.': 12,
};

const ENGLISH_MONTH_ALIASES = {
  january: 1,   jan: 1,
  february: 2,  feb: 2,
  march: 3,     mar: 3,
  april: 4,     apr: 4,
  may: 5,
  june: 6,      jun: 6,
  july: 7,      jul: 7,
  august: 8,    aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10,  oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function parseMonthName(tok) {
  if (!tok) return null;
  const norm = String(tok).toLowerCase();
  if (ENGLISH_MONTH_ALIASES[norm] != null) return ENGLISH_MONTH_ALIASES[norm];
  if (THAI_MONTH_ALIASES[norm] != null) return THAI_MONTH_ALIASES[norm];
  return null;
}

// Parse the allocation answer:
//   "default"     → DEFAULT_ALLOCATION
//   "70 20 10"    → 0.7 / 0.2 / 0.1 (thai_equity / global_etf / cash)
//   "60 30 10"    → 0.6 / 0.3 / 0.1
//   "60,30,10"    → same
export function parseAllocation(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s === 'default' || s === 'ค่าเริ่มต้น') return { ...DEFAULT_ALLOCATION };
  const parts = s.split(/[\s,]+/).map((p) => Number(p)).filter((n) => Number.isFinite(n));
  if (parts.length !== 3) return null;
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  // Accept both 0-1 and 0-100 input ranges.
  const norm = sum > 1.5 ? parts.map((p) => p / 100) : parts;
  return {
    thai_equity: Number(norm[0]) || 0,
    global_etf:  Number(norm[1]) || 0,
    cash:        Number(norm[2]) || 0,
  };
}
