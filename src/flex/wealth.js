// "ความมั่งคั่ง" Flex card — the Phase 1 wedge of the AIWealthOS rollout.
// Big THB total at the top, per-asset-class breakdown with bars + emoji,
// per-portfolio sub-list, FX freshness footer.

export function netWorthCard({ netWorth, hasGoal = true }) {
  const total = Number(netWorth.total_thb) || 0;
  const breakdown = (netWorth.breakdown || []).slice(0, 7);
  const portfolios = (netWorth.portfolios || []).slice(0, 6);
  const warnings = netWorth.warnings || [];

  const body = [];

  // Big total at the top.
  body.push({
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0EA5E912',
    cornerRadius: '10px',
    paddingAll: '14px',
    spacing: 'xs',
    contents: [
      { type: 'text', text: 'ความมั่งคั่งสุทธิ', size: 'xs', color: '#475569' },
      {
        type: 'text',
        text: fmtThb(total) + ' บาท',
        size: 'xxl',
        weight: 'bold',
        color: '#0F172A',
      },
      ...(netWorth.fx_fetched_at
        ? [{
            type: 'text',
            text: 'อัตราแลกเปลี่ยน · ' + relativeTime(netWorth.fx_fetched_at),
            size: 'xxs',
            color: '#94A3B8',
          }]
        : [{
            type: 'text',
            text: 'อัตราแลกเปลี่ยน · ยังเป็นค่าเริ่มต้น (รอ cron แรก)',
            size: 'xxs',
            color: '#D97706',
          }]),
    ],
  });

  if (breakdown.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: 'สัดส่วนตามประเภทสินทรัพย์',
      weight: 'bold',
      size: 'sm',
      color: '#0F172A',
      margin: 'md',
    });
    for (const b of breakdown) body.push(classRow(b));
  } else {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: 'ยังไม่มีรายการสินทรัพย์ — ส่งภาพพอร์ตเพื่อเริ่มต้น',
      size: 'sm',
      color: '#94A3B8',
      align: 'center',
      margin: 'md',
    });
  }

  if (portfolios.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: 'รายพอร์ต',
      weight: 'bold',
      size: 'sm',
      color: '#0F172A',
      margin: 'md',
    });
    for (const p of portfolios) body.push(portfolioRow(p));
  }

  if (warnings.length) {
    body.push({ type: 'separator', margin: 'md' });
    for (const w of warnings.slice(0, 3)) {
      body.push({
        type: 'text',
        text: '• ' + w,
        wrap: true,
        size: 'xxs',
        color: '#D97706',
      });
    }
  }

  return {
    type: 'flex',
    altText: `ความมั่งคั่งสุทธิ ${fmtThb(total)} บาท`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand(),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(!hasGoal && total > 0
            ? [{
                type: 'button',
                style: 'primary',
                color: '#16A34A',
                height: 'sm',
                action: {
                  type: 'message',
                  label: '🎯 ตั้งเป้าหมายความมั่งคั่ง',
                  text: 'ตั้งเป้าหมาย',
                },
              }]
            : []),
          {
            type: 'text',
            text: 'รวมทุกพอร์ตเป็นเงินบาท · เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน',
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

function heroBand() {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0F172A',
    paddingAll: '20px',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '💰', size: 'xl', flex: 0 },
          { type: 'text', text: 'ความมั่งคั่ง', color: '#F8FAFC', weight: 'bold', size: 'lg', flex: 5, gravity: 'center' },
        ],
      },
      {
        type: 'text',
        text: 'มุมมองเดียวของทุกพอร์ต · ปกติเป็นเงินบาท',
        color: '#94A3B8',
        size: 'xs',
        margin: 'sm',
        wrap: true,
      },
    ],
  };
}

function classRow(b) {
  const widthPct = Math.max(2, Math.min(100, Math.round(b.pct || 0)));
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'sm',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          { type: 'text', text: b.emoji || '📦', size: 'sm', flex: 0 },
          { type: 'text', text: b.label || b.class, size: 'sm', weight: 'bold', color: '#0F172A', flex: 4, gravity: 'center' },
          {
            type: 'text',
            text: `${Math.round(b.pct || 0)}%`,
            size: 'xs',
            weight: 'bold',
            color: b.color || '#0F172A',
            align: 'end',
            flex: 2,
          },
        ],
      },
      {
        type: 'text',
        text: fmtThb(b.value_thb) + ' บาท',
        size: 'xxs',
        color: '#475569',
      },
      // Allocation bar
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#E2E8F0',
        height: '6px',
        cornerRadius: '3px',
        contents: [{
          type: 'box',
          layout: 'vertical',
          backgroundColor: b.color || '#0EA5E9',
          width: `${widthPct}%`,
          height: '6px',
          cornerRadius: '3px',
          contents: [{ type: 'filler' }],
        }],
      },
    ],
  };
}

function portfolioRow(p) {
  const totalText = p.total_thb != null ? fmtThb(p.total_thb) + ' บาท' : '—';
  const sub = p.currency !== 'THB' && p.total_native != null
    ? `${p.currency} ${fmtThb(p.total_native)} · ${p.holding_count || 0} ตัว`
    : `${p.holding_count || 0} ตัว`;
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    margin: 'sm',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        flex: 4,
        contents: [
          { type: 'text', text: p.name || 'พอร์ต', size: 'sm', weight: 'bold', color: '#0F172A' },
          { type: 'text', text: sub, size: 'xxs', color: '#94A3B8' },
        ],
      },
      {
        type: 'text',
        text: totalText,
        size: 'sm',
        weight: 'bold',
        color: '#0F172A',
        align: 'end',
        flex: 3,
        gravity: 'center',
      },
    ],
  };
}

function fmtThb(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function relativeTime(unix) {
  if (!unix) return 'ไม่ทราบ';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - Number(unix));
  if (diff < 3600) return `${Math.round(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.round(diff / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.round(diff / 86400)} วันที่แล้ว`;
}
