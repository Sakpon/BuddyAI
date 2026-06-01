// AIWealthOS Phase 2 (cont.) — weekly goal-status digest.
//
// Pushes a Sunday-evening "where are you on plan?" summary to every user
// with an active goal. Distinct from the daily nudge cron (which is
// behavior-prompting); this is a quiet retrospective.

import { ASSET_CLASSES } from '../assetclass.js';

export function weeklyStatusCard({
  goal,
  netWorthThb,
  expectedNowThb,
  contributionsTotalThb,
  contributionsThisMonthThb,
  monthsElapsed,
  topClass,
  bottomClass,
  weekStartIso,
  weekEndIso,
}) {
  const target = Number(goal.targetAmountThb) || 0;
  const nw = Number(netWorthThb) || 0;
  const progressPct = target > 0 ? Math.min(100, (nw / target) * 100) : 0;
  const widthPct = Math.max(2, Math.round(progressPct));

  const expected = Number(expectedNowThb) || 0;
  let tone, emoji, label;
  if (expected <= 0 || nw >= expected * 0.95) {
    tone = { color: '#16A34A', bg: '#DCFCE7' };
    emoji = '🟢';
    label = 'อยู่ในแผน';
  } else if (nw >= expected * 0.75) {
    tone = { color: '#D97706', bg: '#FEF3C7' };
    emoji = '🟡';
    label = 'ตามไม่ทันแผน';
  } else {
    tone = { color: '#DC2626', bg: '#FEE2E2' };
    emoji = '🔴';
    label = 'ห่างจากแผนมาก';
  }

  // DCA discipline — how much should you have contributed cumulatively
  // by now vs how much you actually have?
  const expectedDcaTotal = Number(goal.monthlyContributionThb) * Math.max(0, monthsElapsed);
  const dcaAdherencePct = expectedDcaTotal > 0
    ? Math.min(100, ((Number(contributionsTotalThb) || 0) / expectedDcaTotal) * 100)
    : null;
  const dcaThisMonthLooksOnTrack = Number(contributionsThisMonthThb || 0)
    >= Number(goal.monthlyContributionThb) * 0.9;

  const body = [];

  body.push({
    type: 'box',
    layout: 'vertical',
    backgroundColor: tone.bg,
    cornerRadius: '10px',
    paddingAll: '14px',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          { type: 'text', text: emoji, size: 'lg', flex: 0 },
          { type: 'text', text: label, weight: 'bold', size: 'md', color: tone.color, flex: 5, gravity: 'center' },
          { type: 'text', text: `${Math.round(progressPct)}%`, size: 'lg', weight: 'bold', color: tone.color, align: 'end', flex: 2 },
        ],
      },
      {
        type: 'text',
        text: `${fmtThb(nw)} / ${fmtThb(target)} บาท`,
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
          backgroundColor: tone.color,
          width: `${widthPct}%`,
          height: '8px',
          cornerRadius: '4px',
          contents: [{ type: 'filler' }],
        }],
      },
    ],
  });

  // Glidepath delta — where you should be vs where you are
  if (expected > 0) {
    const delta = nw - expected;
    const deltaColor = delta >= 0 ? '#16A34A' : '#DC2626';
    body.push({ type: 'separator', margin: 'md' });
    body.push(kvRow('ควรจะมี ณ ตอนนี้', fmtThb(expected) + ' บาท', '#475569'));
    body.push(kvRow(
      'ห่างจากแผน',
      (delta >= 0 ? '+' : '') + fmtThb(delta) + ' บาท',
      deltaColor,
    ));
  }

  // DCA discipline this month
  body.push({ type: 'separator', margin: 'md' });
  body.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'md',
    contents: [
      { type: 'text', text: 'วินัย DCA', weight: 'bold', size: 'sm', color: '#0F172A', flex: 4 },
      {
        type: 'text',
        text: dcaThisMonthLooksOnTrack ? '✓ เดือนนี้ครบแผน' : '! ยังขาดเดือนนี้',
        size: 'xs',
        weight: 'bold',
        color: dcaThisMonthLooksOnTrack ? '#16A34A' : '#D97706',
        align: 'end',
        flex: 4,
      },
    ],
  });
  body.push(kvRow(
    'เติมเดือนนี้',
    fmtThb(contributionsThisMonthThb || 0) + ' / ' + fmtThb(goal.monthlyContributionThb) + ' บาท',
    '#1E293B',
  ));
  if (dcaAdherencePct != null) {
    body.push(kvRow(
      'วินัยสะสม',
      `${Math.round(dcaAdherencePct)}%`,
      dcaAdherencePct >= 90 ? '#16A34A' : '#D97706',
    ));
  }

  // Asset highlight — which class is doing best/worst by weight vs target.
  if (topClass || bottomClass) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'จุดที่เด่นและจุดที่ขาด', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    if (topClass) body.push(highlightRow('เกินเป้ามากสุด', topClass, '#DC2626'));
    if (bottomClass) body.push(highlightRow('ขาดเป้ามากสุด', bottomClass, '#16A34A'));
  }

  return {
    type: 'flex',
    altText: `สรุปสัปดาห์ · ${label}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('📅 สรุปสัปดาห์นี้', weekRangeLabel(weekStartIso, weekEndIso), '#0EA5E9'),
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
              type: 'message',
              label: 'ดูแผนเต็ม',
              text: 'เป้าหมาย',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ดูทรัพย์สินรวม',
              text: 'ความมั่งคั่ง',
            },
          },
          {
            type: 'text',
            text: 'ส่งทุกวันอาทิตย์ · สรุปย้อนหลัง ไม่ใช่คำแนะนำการลงทุน',
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

function highlightRow(label, drift, accent) {
  const meta = ASSET_CLASSES[drift.class] || ASSET_CLASSES.other;
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    margin: 'sm',
    paddingAll: '8px',
    cornerRadius: '6px',
    backgroundColor: '#F8FAFC',
    contents: [
      { type: 'text', text: meta.emoji, size: 'sm', flex: 0 },
      {
        type: 'box',
        layout: 'vertical',
        flex: 5,
        contents: [
          { type: 'text', text: label, size: 'xxs', color: '#94A3B8' },
          { type: 'text', text: meta.label, size: 'sm', weight: 'bold', color: '#0F172A' },
        ],
      },
      {
        type: 'text',
        text: `${drift.driftPP > 0 ? '+' : ''}${Math.round(drift.driftPP)}pp`,
        size: 'sm',
        weight: 'bold',
        color: accent,
        align: 'end',
        flex: 3,
        gravity: 'center',
      },
    ],
  };
}

function kvRow(label, value, color) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#475569', flex: 4 },
      { type: 'text', text: value || '—', size: 'sm', weight: 'bold', color: color || '#0F172A', align: 'end', flex: 4 },
    ],
  };
}

function heroBand(title, subtitle, accent) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: accent || '#0F172A',
    paddingAll: '20px',
    contents: [
      { type: 'text', text: title, color: '#FFFFFF', weight: 'bold', size: 'lg' },
      ...(subtitle
        ? [{ type: 'text', text: subtitle, color: '#FFFFFFB3', size: 'xs', margin: 'sm', wrap: true }]
        : []),
    ],
  };
}

function weekRangeLabel(startIso, endIso) {
  if (!startIso || !endIso) return '';
  const fmt = (iso) => {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      calendar: 'gregory',
      day: 'numeric',
      month: 'short',
    }).format(d);
  };
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function fmtThb(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
