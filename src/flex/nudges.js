// AIWealthOS Phase 2 — Flex cards for the nudge engine.

import { ASSET_CLASSES } from '../assetclass.js';

// Drift nudge — shown when the user's allocation has wandered more than
// DRIFT_THRESHOLD_PP from their goal. Lists the worst offender + suggests
// channeling next DCA toward the underweight class instead of generic rebalancing.
export function driftNudgeCard({ driftReport, goal }) {
  const top3 = (driftReport?.drifts || []).slice(0, 3);
  const over = driftReport?.overweight;
  const under = driftReport?.underweight;

  // Headline action: prefer "send your next DCA to underweight class" over
  // explicit selling, which (a) costs nothing and (b) keeps us safely on
  // the education-not-advice side of the ก.ล.ต. line.
  const headlineSuggestion = under
    ? `เดือนนี้ DCA ไปทาง "${classLabelOf(under.class)}" จะช่วยดึงพอร์ตกลับเข้าแผน`
    : over
      ? `เดือนนี้ลดสัดส่วน "${classLabelOf(over.class)}" — ใช้ DCA ของเดือนนี้ไปทางอื่นได้`
      : 'พิจารณา rebalance พอร์ตให้ใกล้แผน';

  return {
    type: 'flex',
    altText: `พอร์ตเอียงจากแผน ~${Math.round(driftReport.maxDriftPP)}pp`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('🧭 พอร์ตเอียงจากแผน', `ห่างเป้าไปประมาณ ${Math.round(driftReport.maxDriftPP)} จุด`, '#D97706'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: headlineSuggestion,
            wrap: true,
            size: 'sm',
            weight: 'bold',
            color: '#0F172A',
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'รายละเอียดต่อกลุ่ม',
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            margin: 'md',
          },
          ...top3.map(driftRow),
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
            color: '#0EA5E9',
            height: 'sm',
            action: {
              type: 'postback',
              label: `บันทึก DCA เดือนนี้`,
              data: 'action=goal-log-monthly',
              displayText: `บันทึก DCA ${Math.round(goal.monthlyContributionThb).toLocaleString('en-US')} บาท`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ดูแผนการลงทุน',
              text: 'เป้าหมาย',
            },
          },
          {
            type: 'text',
            text: 'ข้อมูลเชิงการศึกษา · ไม่ใช่คำแนะนำการลงทุน',
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

// Monthly DCA reminder — fires once per month on user's DCA day. Big
// "DCA เดือนนี้ ฿X" hero + one-tap log button.
export function dcaReminderCard({ goal, ym, holdingsCount = 0 }) {
  const monthly = Number(goal.monthlyContributionThb) || 0;
  const allocation = goal.allocationTargets || {};
  const allocLines = Object.entries(allocation)
    .filter(([, pct]) => Number(pct) > 0)
    .slice(0, 4)
    .map(([cls, pct]) => {
      const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
      const slice = monthly * Number(pct);
      return {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: meta.emoji, size: 'sm', flex: 0 },
          { type: 'text', text: meta.label, size: 'sm', color: '#1E293B', flex: 5, margin: 'sm' },
          {
            type: 'text',
            text: Math.round(slice).toLocaleString('en-US'),
            size: 'sm',
            weight: 'bold',
            color: meta.color,
            align: 'end',
            flex: 3,
          },
        ],
      };
    });

  return {
    type: 'flex',
    altText: `DCA เดือนนี้ ฿${Math.round(monthly).toLocaleString('en-US')}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('💸 ถึงเวลา DCA เดือนนี้', `เดือน ${ym} · ตามแผนที่ตั้งไว้`, '#16A34A'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#16A34A14',
            cornerRadius: '10px',
            paddingAll: '14px',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'เติม DCA เดือนนี้', size: 'xs', color: '#475569' },
              {
                type: 'text',
                text: Math.round(monthly).toLocaleString('en-US') + ' บาท',
                size: 'xxl',
                weight: 'bold',
                color: '#16A34A',
              },
              ...(holdingsCount > 0
                ? [{ type: 'text', text: `กระจายในพอร์ต ${holdingsCount} ตัว`, size: 'xxs', color: '#475569' }]
                : []),
            ],
          },
          ...(allocLines.length
            ? [
                { type: 'separator', margin: 'md' },
                { type: 'text', text: 'แบ่งตามแผน', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' },
                ...allocLines,
              ]
            : []),
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
            height: 'sm',
            action: {
              type: 'postback',
              label: '✓ บันทึก DCA เดือนนี้',
              data: 'action=goal-log-monthly',
              displayText: `บันทึก DCA ${Math.round(monthly).toLocaleString('en-US')} บาท`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ปรับยอด',
              text: 'เป้าหมาย',
            },
          },
          {
            type: 'text',
            text: 'การกดบันทึกเป็นเพียงการเก็บสถิติ — ระบบไม่ได้ส่งคำสั่งซื้อขายจริง',
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

function driftRow(d) {
  const meta = ASSET_CLASSES[d.class] || ASSET_CLASSES.other;
  const pp = d.driftPP;
  const tone = Math.abs(pp) < 3 ? '#94A3B8' : pp > 0 ? '#DC2626' : '#16A34A';
  const arrow = pp > 0 ? '↑' : pp < 0 ? '↓' : '•';
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'sm',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: meta.emoji, size: 'sm', flex: 0 },
          { type: 'text', text: meta.label, size: 'sm', weight: 'bold', color: '#0F172A', flex: 5, margin: 'sm' },
          {
            type: 'text',
            text: `${arrow} ${Math.abs(Math.round(pp))}pp`,
            size: 'xs',
            weight: 'bold',
            color: tone,
            align: 'end',
            flex: 3,
          },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: `ปัจจุบัน ${Math.round(d.currentPct)}%`, size: 'xxs', color: '#94A3B8', flex: 3 },
          { type: 'text', text: `เป้า ${Math.round(d.targetPct)}%`, size: 'xxs', color: '#475569', align: 'end', flex: 3 },
        ],
      },
    ],
  };
}

function heroBand(title, subtitle, accent = '#0F172A') {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: accent,
    paddingAll: '20px',
    contents: [
      { type: 'text', text: title, color: '#FFFFFF', weight: 'bold', size: 'lg' },
      ...(subtitle
        ? [{ type: 'text', text: subtitle, color: '#FFFFFFB3', size: 'xs', margin: 'sm', wrap: true }]
        : []),
    ],
  };
}

function classLabelOf(cls) {
  return ASSET_CLASSES[cls]?.label || cls || 'อื่นๆ';
}
