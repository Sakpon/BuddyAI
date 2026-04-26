export function portfolioConfirmCard(extracted) {
  const holdings = (extracted.holdings || []).slice(0, 10);
  const warnings = extracted.warnings || [];
  const rows = holdings.map((h) => holdingRow(h, false));
  const tail = (extracted.holdings || []).length > 10
    ? [{ type: 'text', text: `+ อีก ${extracted.holdings.length - 10} ตัว`, size: 'xs', color: '#94A3B8', margin: 'sm' }]
    : [];

  return {
    type: 'flex',
    altText: 'ยืนยันข้อมูลพอร์ต',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('ตรวจสอบข้อมูลพอร์ต', extracted.source || 'อ่านจากภาพ'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          totalsBox(extracted),
          { type: 'separator' },
          ...rows,
          ...tail,
          ...(warnings.length
            ? [
                { type: 'separator', margin: 'md' },
                { type: 'text', text: 'คำเตือน', weight: 'bold', size: 'xs', color: '#DC2626' },
                ...warnings.slice(0, 3).map((w) => ({
                  type: 'text',
                  text: '• ' + w,
                  wrap: true,
                  size: 'xs',
                  color: '#DC2626',
                })),
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
            action: {
              type: 'postback',
              label: 'บันทึกพอร์ต',
              data: 'action=confirm-portfolio',
              displayText: 'บันทึกพอร์ต',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'อ่านใหม่ / ลองอีกครั้ง',
              data: 'action=retry-portfolio',
              displayText: 'ยกเลิก ลองส่งภาพใหม่',
            },
          },
          {
            type: 'text',
            text: 'ข้อมูลในภาพอาจอ่านผิดได้ ตรวจสอบก่อนกดบันทึก',
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

export function portfolioSummaryCard({ portfolio, holdings }) {
  const rows = (holdings || []).slice(0, 10).map((h) => holdingRow(h, true));
  return {
    type: 'flex',
    altText: 'พอร์ตของคุณ',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('พอร์ตของคุณ', portfolio.source || ''),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          totalsBox(portfolio),
          { type: 'separator' },
          ...rows,
          ...((holdings || []).length > 10
            ? [{ type: 'text', text: `+ อีก ${holdings.length - 10} ตัว`, size: 'xs', color: '#94A3B8', margin: 'sm' }]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์ "วิเคราะห์พอร์ต" เพื่อขอความเห็นจาก AI',
            size: 'xxs',
            color: '#475569',
            wrap: true,
            align: 'center',
          },
        ],
      },
    },
  };
}

function hero(title, subtitle) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0F172A',
    paddingAll: '20px',
    contents: [
      { type: 'text', text: title, color: '#F8FAFC', weight: 'bold', size: 'lg' },
      ...(subtitle
        ? [{ type: 'text', text: subtitle, color: '#94A3B8', size: 'xs', margin: 'sm' }]
        : []),
    ],
  };
}

function totalsBox(p) {
  const items = [];
  if (p.total_value != null) items.push(kv('มูลค่ารวม', fmtMoney(p.total_value)));
  if (p.cash != null) items.push(kv('เงินสด', fmtMoney(p.cash)));
  if (!items.length) items.push({ type: 'text', text: '—', size: 'sm', color: '#94A3B8' });
  return { type: 'box', layout: 'vertical', spacing: 'xs', contents: items };
}

function kv(k, v) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: k, size: 'sm', color: '#475569', flex: 2 },
      { type: 'text', text: v, size: 'sm', color: '#0F172A', align: 'end', flex: 3 },
    ],
  };
}

function holdingRow(h, dim) {
  const left = h.symbol || '?';
  const qty = h.quantity != null ? `x${h.quantity}` : '';
  const right = h.market_value != null
    ? fmtMoney(h.market_value)
    : h.weight_pct != null
      ? `${Math.round(h.weight_pct)}%`
      : '';
  const plColor = h.unrealized_pl == null
    ? '#475569'
    : h.unrealized_pl >= 0
      ? '#16A34A'
      : '#DC2626';
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: left, size: 'sm', weight: 'bold', color: dim ? '#0F172A' : '#1E293B', flex: 2 },
      { type: 'text', text: qty, size: 'xs', color: '#94A3B8', flex: 2 },
      {
        type: 'text',
        text: right,
        size: 'sm',
        color: h.unrealized_pl != null ? plColor : '#0F172A',
        align: 'end',
        flex: 3,
      },
    ],
  };
}

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
