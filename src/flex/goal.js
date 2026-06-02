// Goal-tracking Flex cards — the "PLAN" module of AIWealthOS.
//
// goalCard       — main view: target, horizon, monthly contribution, progress
// goalConfirmCard — wizard confirmation: shown after the 3-step wizard before save

import { ASSET_CLASSES } from '../assetclass.js';

export function goalCard({
  goal,
  netWorthThb,
  expectedNowThb,
  contributionsTotalThb,
  // Distinct calendar months with at least one logged DCA (Asia/Bangkok).
  // Used by section 3's "จำนวนเดือนที่เติม DCA" line.
  monthsContributed = 0,
  monthsElapsed,
  // Optional plan-vs-actual analytics computed in showGoal. When omitted
  // (e.g. updateGoalFields preview, monthsElapsed=0) the comparison
  // section is skipped to avoid showing noisy zero-data rows.
  comparison = null,
  // Optional actual allocation breakdown from getNetWorth — array of
  // { class, label, emoji, color, value_thb, pct, ... }. Drives the
  // planned vs actual comparison rows in the allocation section.
  actualAllocation = [],
}) {
  const targetText = fmtThb(goal.targetAmountThb) + ' บาท';
  const target = Number(goal.targetAmountThb) || 0;
  // Progress toward the goal = tracked portfolio net worth PLUS the running
  // total of DCA contributions the user has logged. Logging a DCA via the
  // wizard writes to the contributions ledger but does not touch portfolio
  // holdings, so without this sum the bar would never move until the user
  // re-synced their portfolio. (Note: this can double-count once a freshly
  // synced portfolio already includes the deposited money — an accepted
  // trade-off so the bar always reflects logged DCA immediately.)
  const accumulated = (Number(netWorthThb) || 0) + (Number(contributionsTotalThb) || 0);
  const progressPct = target > 0 ? Math.min(100, (accumulated / target) * 100) : 0;
  const widthPct = Math.max(2, Math.round(progressPct));

  // On-track / lagging / off-track status based on accumulated value vs the
  // glidepath value at month t.
  const expected = Number(expectedNowThb) || 0;
  let statusTone, statusEmoji, statusLabel;
  if (expected <= 0 || accumulated >= expected * 0.95) {
    statusTone = { color: '#16A34A', bg: '#DCFCE7' };
    statusEmoji = '🟢';
    statusLabel = 'อยู่ในแผน';
  } else if (accumulated >= expected * 0.75) {
    statusTone = { color: '#D97706', bg: '#FEF3C7' };
    statusEmoji = '🟡';
    statusLabel = 'ตามไม่ทันแผน';
  } else {
    statusTone = { color: '#DC2626', bg: '#FEE2E2' };
    statusEmoji = '🔴';
    statusLabel = 'ห่างจากแผนมาก';
  }

  const body = [];

  // ── Section 1 · Progress bar + status banner ─────────────────────────
  body.push({
    type: 'box',
    layout: 'vertical',
    backgroundColor: statusTone.bg,
    cornerRadius: '10px',
    paddingAll: '14px',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          { type: 'text', text: statusEmoji, size: 'lg', flex: 0 },
          { type: 'text', text: statusLabel, weight: 'bold', size: 'md', color: statusTone.color, flex: 5, gravity: 'center' },
          { type: 'text', text: `${Math.round(progressPct)}%`, size: 'lg', weight: 'bold', color: statusTone.color, align: 'end', flex: 2 },
        ],
      },
      {
        type: 'text',
        text: `${fmtThb(accumulated)} / ${targetText}`,
        size: 'xs',
        color: '#475569',
      },
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#FFFFFF',
        height: '8px',
        cornerRadius: '4px',
        contents: [{
          type: 'box',
          layout: 'vertical',
          backgroundColor: statusTone.color,
          width: `${widthPct}%`,
          height: '8px',
          cornerRadius: '4px',
          contents: [{ type: 'filler' }],
        }],
      },
    ],
  });

  // ── Section 2 · 🎯 ตามแผน ─────────────────────────────────────────────
  const yearsLeft = goal.targetYear - new Date().getUTCFullYear();
  const targetItems = [
    sectionHeader('🎯 แผนที่ตั้งไว้', 'สิ่งที่คุณตั้งใจไว้'),
    kvRow('ยอดเป้าหมาย', `${targetText}`),
    kvRow('ภายในปี', `${goal.targetYear}  (อีก ${yearsLeft} ปี)`),
    kvRow('DCA / เดือน', `${fmtThb(goal.monthlyContributionThb)} บาท`),
  ];
  if (goal._currentOverride && goal._currentOverride.amount_thb != null) {
    const o = goal._currentOverride;
    const diff = Number(o.amount_thb) - Number(goal.monthlyContributionThb);
    const diffColor = diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#475569';
    targetItems.push(kvRow(
      `↳ เดือนนี้ (${o.ym})`,
      `${fmtThb(o.amount_thb)} บาท${diff !== 0 ? ` (${diff > 0 ? '+' : ''}${fmtThb(diff)})` : ''}`,
      diffColor,
    ));
  }
  targetItems.push(kvRow('สมมุติผลตอบแทน', `${Number(goal.expectedReturnPct).toFixed(1)}% / ปี`));
  body.push({ type: 'separator', margin: 'md' });
  body.push(sectionPanel('#0EA5E912', targetItems));

  // ── Section 3 · 📈 ทำได้จริง — two bullets only ───────────────────────
  const actualContribTotal = Number(contributionsTotalThb) || 0;
  const actualItems = [
    sectionHeader('📈 ทำได้จริง', 'สิ่งที่คุณทำมาแล้ว'),
  ];
  if (actualContribTotal > 0 || monthsContributed > 0) {
    actualItems.push(bulletRow('💸', 'DCA ที่เติมแล้ว', `${fmtThb(actualContribTotal)} บาท`));
    actualItems.push(bulletRow('📅', 'จำนวนเดือนที่เติม DCA', `${monthsContributed} เดือน`));
  } else {
    actualItems.push({
      type: 'text',
      text: 'ยังไม่มีการเติม DCA — เริ่มเดือนนี้ได้เลยจากปุ่มด้านล่าง',
      size: 'xxs', color: '#94A3B8', wrap: true, margin: 'sm',
    });
  }
  body.push({ type: 'separator', margin: 'md' });
  body.push(sectionPanel('#F8FAFC', actualItems));

  // ── Section 4 · 🚦 สรุป — on-track? เร็วช้าแค่ไหน? ──────────────────
  const summaryItems = [
    sectionHeader('🚦 สรุป', 'อยู่ในแผนไหม · เร็วช้าแค่ไหน'),
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'sm',
      contents: [
        { type: 'text', text: statusEmoji, size: 'xxl', flex: 0 },
        {
          type: 'box',
          layout: 'vertical',
          flex: 6,
          contents: [
            { type: 'text', text: statusLabel, weight: 'bold', size: 'md', color: statusTone.color },
            { type: 'text', text: `ความคืบหน้า ${Math.round(progressPct)}%`, size: 'xxs', color: '#475569' },
          ],
        },
      ],
    },
  ];
  if (comparison?.projectedReachYear != null && comparison?.plannedReachYear != null) {
    const yb = comparison.yearsBehind;
    const reachLabel = comparison.projectedReachYear === Infinity
      ? 'ไม่ถึงเป้าด้วยอัตรานี้'
      : String(comparison.projectedReachYear);
    let trail, trailColor;
    if (yb === 0) { trail = '· ตรงตามแผน'; trailColor = '#16A34A'; }
    else if (yb > 0) { trail = `· ช้ากว่าแผน ${Math.abs(yb)} ปี`; trailColor = yb <= 1 ? '#D97706' : '#DC2626'; }
    else { trail = `· เร็วกว่าแผน ${Math.abs(yb)} ปี`; trailColor = '#16A34A'; }
    summaryItems.push(kvRow('ปีที่จะถึงเป้า', `${reachLabel} ${trail}`, trailColor));
  } else if (comparison?.projectedReachYear === null) {
    summaryItems.push({
      type: 'text',
      text: '⚠️ อัตรานี้ไม่พอจะถึงเป้า — ต้องเพิ่ม DCA หรือผลตอบแทน',
      size: 'xs', color: '#DC2626', wrap: true, margin: 'sm',
    });
  }
  const isBehind = comparison && (comparison.yearsBehind > 0 || comparison.projectedReachYear === null);
  if (isBehind) {
    if (comparison.requiredMonthlyToHit != null && Number.isFinite(comparison.requiredMonthlyToHit)) {
      summaryItems.push(kvRow(
        'ถ้าจะให้ทันแผน',
        `เติม ${fmtThb(comparison.requiredMonthlyToHit)} บาท / เดือน`,
        '#DC2626',
      ));
    }
    if (comparison.requiredReturnPctToHit != null) {
      summaryItems.push(kvRow(
        'หรือผลตอบแทนต้องได้',
        `${comparison.requiredReturnPctToHit.toFixed(1)}% / ปี`,
        '#DC2626',
      ));
    }
  } else if (comparison && comparison.yearsBehind < 0) {
    summaryItems.push({
      type: 'text',
      text: '🎉 ทำได้เร็วกว่าแผน — คงระดับนี้ไว้',
      size: 'xs', color: '#16A34A', wrap: true, margin: 'sm',
    });
  }
  body.push({ type: 'separator', margin: 'md' });
  body.push(sectionPanel(statusTone.bg, summaryItems));

  // ── Section 5 · 🥧 สัดส่วน — planned vs actual ───────────────────────
  const alloc = goal.allocationTargets || {};
  const allocEntries = Object.entries(alloc).filter(([, pct]) => Number(pct) > 0);
  if (allocEntries.length) {
    // Lookup actual % per class from getNetWorth's breakdown. Classes
    // present in the portfolio but not in the plan get appended at the end
    // so the user sees "off-plan" holdings (e.g. crypto in a non-crypto
    // plan) explicitly.
    const actualByClass = new Map();
    for (const b of (actualAllocation || [])) {
      if (b?.class) actualByClass.set(b.class, Number(b.pct) || 0);
    }
    const plannedClasses = new Set(allocEntries.map(([cls]) => cls));
    const extraActual = (actualAllocation || []).filter(
      (b) => b?.class && !plannedClasses.has(b.class) && Number(b.pct) > 0.5,
    );

    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: '🥧 สัดส่วน · แผน vs ทำจริง',
      weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md',
    });
    // Two-column header
    body.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        { type: 'text', text: ' ', size: 'xxs', flex: 5 },
        { type: 'text', text: 'แผน', size: 'xxs', color: '#94A3B8', align: 'end', flex: 2 },
        { type: 'text', text: 'ทำจริง', size: 'xxs', color: '#94A3B8', align: 'end', flex: 2 },
      ],
    });
    for (const [cls, pct] of allocEntries) {
      body.push(allocCompareRow(cls, Number(pct) * 100, actualByClass.get(cls) ?? 0));
    }
    for (const b of extraActual) {
      body.push(allocCompareRow(b.class, 0, Number(b.pct) || 0));
    }
  }

  return {
    type: 'flex',
    altText: `เป้าหมาย ${targetText}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('🎯 เป้าหมายความมั่งคั่ง', `อีก ${goal.targetYear - new Date().getUTCFullYear()} ปี · ${fmtThb(goal.monthlyContributionThb)} บาท / เดือน`),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0EA5E9',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'บันทึก DCA เดือนนี้',
              data: 'action=goal-log-monthly',
              displayText: `บันทึก DCA ${fmtThb(goal.monthlyContributionThb)} บาท`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: '✏️ ปรับเป้าหมาย',
              text: 'ปรับเป้าหมาย',
            },
          },
          {
            type: 'text',
            text: 'เพื่อการศึกษาเท่านั้น · ผลตอบแทนจริงไม่รับประกัน',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
            wrap: true,
          },
        ],
      },
    },
  };
}

// Edit menu — surfaced when user taps "✏️ ปรับเป้าหมาย" on the goal card
// or types "ปรับเป้าหมาย". Four buttons, each fires a postback that opens
// a one-question wizard for that specific field.
export function goalEditMenuCard({ goal }) {
  const years = goal.targetYear - new Date().getUTCFullYear();
  return {
    type: 'flex',
    altText: 'ปรับเป้าหมาย — เลือกสิ่งที่อยากเปลี่ยน',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('✏️ ปรับเป้าหมาย', 'เลือกหัวข้อที่อยากเปลี่ยน'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          editFieldRow(
            '💰',
            'ปรับยอดเป้าหมาย',
            `ตอนนี้: ${fmtThb(goal.targetAmountThb)} บาท`,
            'edit-amount',
            '#0EA5E9',
          ),
          editFieldRow(
            '📅',
            'ปรับระยะเวลา',
            `ตอนนี้: ปี ${goal.targetYear} (อีก ${years} ปี)`,
            'edit-horizon',
            '#0EA5E9',
          ),
          editFieldRow(
            '📈',
            'ปรับสมมุติผลตอบแทน',
            `ตอนนี้: ${Number(goal.expectedReturnPct).toFixed(1)}% / ปี`,
            'edit-return',
            '#16A34A',
          ),
          editFieldRow(
            '💸',
            'ปรับ DCA / เดือน',
            `ตอนนี้: ${fmtThb(goal.monthlyContributionThb)} บาท / เดือน`,
            'edit-dca',
            '#16A34A',
          ),
          editFieldRow(
            '🎯',
            'ปรับสัดส่วนการลงทุน',
            allocationSummary(goal.allocationTargets),
            'edit-allocation',
            '#D97706',
          ),
          // Open the DCA schedule view — for per-month overrides like
          // bonus months. Uses a message action so it goes through the
          // existing "ตาราง dca" command path instead of needing a new
          // postback handler.
          {
            type: 'box',
            layout: 'vertical',
            paddingAll: '10px',
            cornerRadius: '8px',
            backgroundColor: '#F8FAFC',
            spacing: 'xs',
            margin: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '📆', size: 'md', flex: 0 },
                  {
                    type: 'text',
                    text: 'ตารางการเติม DCA',
                    size: 'sm',
                    weight: 'bold',
                    color: '#0F172A',
                    flex: 5,
                    gravity: 'center',
                  },
                ],
              },
              { type: 'text', text: 'ตั้งยอด DCA เฉพาะบางเดือน เช่น เดือนโบนัส', size: 'xxs', color: '#475569' },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                margin: 'sm',
                action: {
                  type: 'message',
                  label: 'เปิดตาราง DCA',
                  text: 'ตาราง dca',
                },
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'กลับไปดูเป้าหมาย',
              text: 'เป้าหมาย',
            },
          },
          {
            type: 'text',
            text: 'การปรับยอด/เวลา/ผลตอบแทน บอท จะคำนวณ DCA ใหม่ให้อัตโนมัติ',
            size: 'xxs',
            color: '#94A3B8',
            wrap: true,
            align: 'center',
          },
        ],
      },
    },
  };
}

function editFieldRow(emoji, title, current, postbackField, accentColor) {
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '10px',
    cornerRadius: '8px',
    backgroundColor: '#F8FAFC',
    spacing: 'xs',
    margin: 'sm',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          { type: 'text', text: emoji, size: 'md', flex: 0 },
          { type: 'text', text: title, size: 'sm', weight: 'bold', color: '#0F172A', flex: 5, gravity: 'center' },
        ],
      },
      { type: 'text', text: current, size: 'xxs', color: '#475569' },
      {
        type: 'button',
        style: 'primary',
        color: accentColor,
        height: 'sm',
        margin: 'sm',
        action: {
          type: 'postback',
          label: 'ปรับ',
          data: `action=goal-edit&field=${postbackField}`,
          displayText: `ปรับ ${title}`,
        },
      },
    ],
  };
}

// "ตารางการเติม DCA" — shows standing monthly + any per-month overrides.
// Each override row carries a "ลบ" delete button for one-tap removal.
export function dcaOverridesCard({ goal, overrides, currentYm }) {
  const standing = Number(goal.monthlyContributionThb) || 0;
  const upcoming = (overrides || []).filter((o) => o.year_month >= currentYm).slice(0, 8);
  const past = (overrides || []).filter((o) => o.year_month < currentYm).slice(0, 4);

  const body = [
    {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0EA5E912',
      cornerRadius: '10px',
      paddingAll: '14px',
      spacing: 'xs',
      contents: [
        { type: 'text', text: 'DCA มาตรฐานต่อเดือน', size: 'xs', color: '#475569' },
        { type: 'text', text: fmtThb(standing) + ' บาท', size: 'xxl', weight: 'bold', color: '#0F172A' },
        { type: 'text', text: 'ใช้กับทุกเดือนที่ไม่ได้ตั้งค่า override', size: 'xxs', color: '#94A3B8' },
      ],
    },
  ];

  if (upcoming.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'เดือนที่ปรับไว้แล้ว', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const o of upcoming) body.push(overrideRow(o, standing));
  }

  if (past.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'ผ่านมาแล้ว', weight: 'bold', size: 'sm', color: '#94A3B8', margin: 'md' });
    for (const o of past) body.push(overrideRow(o, standing, true));
  }

  if (!upcoming.length && !past.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: '— ยังไม่มี override เดือนไหน —',
      size: 'sm',
      color: '#94A3B8',
      align: 'center',
    });
  }

  return {
    type: 'flex',
    altText: 'ตารางการเติม DCA',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('📆 ตารางการเติม DCA', 'ปรับยอดเฉพาะบางเดือน เช่น เดือนโบนัส'),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#16A34A',
            height: 'sm',
            action: {
              type: 'postback',
              label: '➕ ปรับ DCA เดือนใหม่',
              data: 'action=dca-override-wizard',
              displayText: 'ปรับ DCA เดือนใหม่',
            },
          },
          {
            type: 'text',
            text: 'หรือพิมพ์เอง: "ปรับ DCA 80000 มิ.ย. 2026" / "ปรับ DCA 80000 เดือนหน้า"',
            size: 'xxs',
            color: '#94A3B8',
            wrap: true,
            align: 'center',
          },
        ],
      },
    },
  };
}

function overrideRow(o, standing, isPast = false) {
  const amount = Number(o.amount_thb) || 0;
  const diff = amount - standing;
  const diffColor = diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#475569';
  const diffText = diff !== 0
    ? `${diff > 0 ? '+' : ''}${fmtThb(diff)}`
    : 'เท่ามาตรฐาน';
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '8px',
    cornerRadius: '6px',
    backgroundColor: isPast ? '#F1F5F9' : '#F8FAFC',
    spacing: 'xs',
    margin: 'sm',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: formatYearMonthThai(o.year_month), size: 'sm', weight: 'bold', color: isPast ? '#94A3B8' : '#0F172A', flex: 4 },
          {
            type: 'text',
            text: fmtThb(amount) + ' บาท',
            size: 'sm',
            weight: 'bold',
            color: isPast ? '#94A3B8' : '#0F172A',
            align: 'end',
            flex: 4,
          },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: diffText, size: 'xxs', color: isPast ? '#94A3B8' : diffColor, flex: 4 },
          ...(isPast
            ? []
            : [{
                type: 'button',
                style: 'secondary',
                height: 'sm',
                flex: 3,
                action: {
                  type: 'postback',
                  label: 'ลบ override',
                  data: `action=goal-delete-dca-override&ym=${o.year_month}`,
                  displayText: `ลบ override ${o.year_month}`,
                },
              }]),
        ],
      },
    ],
  };
}

function formatYearMonthThai(ym) {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const [, year, mo] = m;
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const idx = Number(mo) - 1;
  if (idx < 0 || idx >= 12) return ym;
  return `${monthNames[idx]} ${year}`;
}

function allocationSummary(allocation) {
  if (!allocation || typeof allocation !== 'object') return 'ยังไม่ได้ตั้ง';
  const parts = Object.entries(allocation)
    .filter(([, pct]) => Number(pct) > 0)
    .slice(0, 4)
    .map(([cls, pct]) => `${cls.split('_')[0]} ${Math.round(Number(pct) * 100)}%`);
  return 'ตอนนี้: ' + (parts.join(' · ') || '—');
}

// Confirmation card shown at the end of the wizard. User taps "ยืนยัน" to
// save the goal, or "ปรับ" to restart.
export function goalConfirmCard({ targetAmountThb, targetYear, expectedReturnPct, monthlyContributionThb, allocation }) {
  const years = targetYear - new Date().getUTCFullYear();
  const allocBody = [];
  for (const [cls, pct] of Object.entries(allocation || {})) {
    if (Number(pct) <= 0) continue;
    const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
    allocBody.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: `${meta.emoji} ${meta.label}`, size: 'sm', color: '#1E293B', flex: 5 },
        { type: 'text', text: `${Math.round(Number(pct) * 100)}%`, size: 'sm', weight: 'bold', color: meta.color, align: 'end', flex: 2 },
      ],
    });
  }
  return {
    type: 'flex',
    altText: 'ยืนยันเป้าหมาย',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('🎯 ตรวจสอบเป้าหมาย', 'ก่อนบันทึก ดูทุกบรรทัดให้แน่ใจ'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#0EA5E912',
            cornerRadius: '10px',
            paddingAll: '14px',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'ต้องเติมเดือนละ', size: 'xs', color: '#475569' },
              { type: 'text', text: fmtThb(monthlyContributionThb) + ' บาท', size: 'xxl', weight: 'bold', color: '#0F172A' },
              { type: 'text', text: `ต่อเนื่อง ${years} ปี รวม ${fmtThb(Number(monthlyContributionThb) * years * 12)} บาท`, size: 'xxs', color: '#475569' },
            ],
          },
          { type: 'separator', margin: 'md' },
          planRow('เป้าหมาย', fmtThb(targetAmountThb) + ' บาท'),
          planRow('ภายในปี', `${targetYear} (${years} ปี)`),
          planRow('สมมุติผลตอบแทน', `${Number(expectedReturnPct).toFixed(1)}% / ปี`),
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'สัดส่วนการลงทุน', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' },
          ...allocBody,
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#16A34A',
            action: {
              type: 'postback',
              label: '✓ บันทึกเป็นเป้าหมาย',
              data: 'action=confirm-goal',
              displayText: 'บันทึกเป้าหมาย',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'ตั้งใหม่',
              data: 'action=cancel-goal-wizard',
              displayText: 'ยกเลิก ตั้งเป้าหมายใหม่',
            },
          },
          {
            type: 'text',
            text: 'ผลตอบแทนจริงอาจต่างจากที่ประมาณ · ทบทวนทุกปี',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
            wrap: true,
          },
        ],
      },
    },
  };
}

function heroBand(title, subtitle) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0F172A',
    paddingAll: '20px',
    contents: [
      { type: 'text', text: title, color: '#F8FAFC', weight: 'bold', size: 'lg' },
      ...(subtitle
        ? [{ type: 'text', text: subtitle, color: '#94A3B8', size: 'xs', margin: 'sm', wrap: true }]
        : []),
    ],
  };
}

function planRow(label, value, color) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#475569', flex: 3 },
      { type: 'text', text: value || '—', size: 'sm', weight: 'bold', color: color || '#0F172A', align: 'end', flex: 4 },
    ],
  };
}

// goalCard section helpers — tinted panels keep each of the four sections
// (Target / Actual / Summary) visually distinct without adding noise.
function sectionPanel(bgColor, contents) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: bgColor,
    cornerRadius: '10px',
    paddingAll: '12px',
    spacing: 'xs',
    margin: 'md',
    contents,
  };
}

function sectionHeader(title, subtitle) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: [
      { type: 'text', text: title, weight: 'bold', size: 'md', color: '#0F172A' },
      ...(subtitle
        ? [{ type: 'text', text: subtitle, size: 'xxs', color: '#475569' }]
        : []),
    ],
  };
}

// Two-line bullet — emoji on the left, big value on the right, label
// underneath. Used by section 3's "ทำได้จริง" two-bullet view.
function bulletRow(emoji, label, value, valueColor) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    spacing: 'md',
    contents: [
      { type: 'text', text: emoji, size: 'xl', flex: 0, gravity: 'center' },
      {
        type: 'box',
        layout: 'vertical',
        flex: 5,
        spacing: 'xs',
        contents: [
          { type: 'text', text: label, size: 'xxs', color: '#475569' },
          {
            type: 'text',
            text: String(value || '—'),
            size: 'md',
            weight: 'bold',
            color: valueColor || '#0F172A',
          },
        ],
      },
    ],
  };
}

// Allocation row — planned % | actual % side-by-side with the delta color
// telegraphing how far off the user is from the target weight.
function allocCompareRow(cls, plannedPct, actualPct) {
  const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
  const delta = actualPct - plannedPct;
  const tone = Math.abs(delta) <= 5 ? '#16A34A'
    : Math.abs(delta) <= 15 ? '#D97706'
    : '#DC2626';
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: meta.emoji, size: 'sm', flex: 0 },
      { type: 'text', text: meta.label, size: 'sm', color: '#1E293B', flex: 5, margin: 'sm' },
      {
        type: 'text',
        text: plannedPct > 0 ? `${Math.round(plannedPct)}%` : '—',
        size: 'sm',
        color: '#94A3B8',
        align: 'end',
        flex: 2,
      },
      {
        type: 'text',
        text: actualPct > 0 ? `${Math.round(actualPct)}%` : '—',
        size: 'sm',
        weight: 'bold',
        color: tone,
        align: 'end',
        flex: 2,
      },
    ],
  };
}

function kvRow(label, value, valueColor) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#475569', flex: 4 },
      {
        type: 'text',
        text: String(value || '—'),
        size: 'sm',
        weight: 'bold',
        color: valueColor || '#0F172A',
        align: 'end',
        flex: 6,
        wrap: true,
      },
    ],
  };
}

function fmtThb(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
