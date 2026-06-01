// Goal-tracking Flex cards — the "PLAN" module of AIWealthOS.
//
// goalCard       — main view: target, horizon, monthly contribution, progress
// goalConfirmCard — wizard confirmation: shown after the 3-step wizard before save

import { ASSET_CLASSES } from '../assetclass.js';

export function goalCard({ goal, netWorthThb, expectedNowThb, contributionsTotalThb, monthsElapsed }) {
  const targetText = fmtThb(goal.targetAmountThb) + ' บาท';
  const target = Number(goal.targetAmountThb) || 0;
  const nw = Number(netWorthThb) || 0;
  const progressPct = target > 0 ? Math.min(100, (nw / target) * 100) : 0;
  const widthPct = Math.max(2, Math.round(progressPct));

  // On-track / lagging / off-track status based on net worth vs the
  // glidepath value at month t.
  const expected = Number(expectedNowThb) || 0;
  let statusTone, statusEmoji, statusLabel;
  if (expected <= 0 || nw >= expected * 0.95) {
    statusTone = { color: '#16A34A', bg: '#DCFCE7' };
    statusEmoji = '🟢';
    statusLabel = 'อยู่ในแผน';
  } else if (nw >= expected * 0.75) {
    statusTone = { color: '#D97706', bg: '#FEF3C7' };
    statusEmoji = '🟡';
    statusLabel = 'ตามไม่ทันแผน';
  } else {
    statusTone = { color: '#DC2626', bg: '#FEE2E2' };
    statusEmoji = '🔴';
    statusLabel = 'ห่างจากแผนมาก';
  }

  const body = [];

  // Status banner
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
        text: `${fmtThb(nw)} / ${targetText}`,
        size: 'xs',
        color: '#475569',
      },
      // Progress bar
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

  // Plan summary
  body.push({ type: 'separator', margin: 'md' });
  body.push({ type: 'text', text: 'แผนการลงทุน', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
  body.push(planRow('เป้าหมาย', targetText));
  body.push(planRow('ภายในปี', `${goal.targetYear} (${goal.targetYear - new Date().getUTCFullYear()} ปี)`));
  body.push(planRow('เติม DCA / เดือน', fmtThb(goal.monthlyContributionThb) + ' บาท'));
  body.push(planRow('สมมุติผลตอบแทน', `${Number(goal.expectedReturnPct).toFixed(1)}% / ปี`));

  // DCA discipline
  if (monthsElapsed > 0) {
    const expectedDcaTotal = Number(goal.monthlyContributionThb) * monthsElapsed;
    const actual = Number(contributionsTotalThb) || 0;
    const adherencePct = expectedDcaTotal > 0
      ? Math.min(100, (actual / expectedDcaTotal) * 100)
      : null;
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'DCA วินัย', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    body.push(planRow('เติมจริงสะสม', fmtThb(actual) + ' บาท'));
    body.push(planRow('ควรเติมแล้ว', fmtThb(expectedDcaTotal) + ' บาท'));
    if (adherencePct != null) {
      body.push(planRow('วินัย', `${Math.round(adherencePct)}%`, adherencePct >= 90 ? '#16A34A' : '#D97706'));
    }
  }

  // Allocation targets
  const alloc = goal.allocationTargets || {};
  const allocEntries = Object.entries(alloc).filter(([, pct]) => Number(pct) > 0);
  if (allocEntries.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'สัดส่วนเป้าหมาย', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const [cls, pct] of allocEntries) {
      const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
      body.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        contents: [
          { type: 'text', text: meta.emoji, size: 'sm', flex: 0 },
          { type: 'text', text: meta.label, size: 'sm', color: '#1E293B', flex: 5, margin: 'sm' },
          { type: 'text', text: `${Math.round(Number(pct) * 100)}%`, size: 'sm', weight: 'bold', color: meta.color, align: 'end', flex: 2 },
        ],
      });
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

function fmtThb(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
