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
