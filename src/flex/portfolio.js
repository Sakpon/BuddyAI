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
      hero: hero(portfolio.name || 'พอร์ตของคุณ', portfolio.source || ''),
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
  const qty = h.quantity != null ? `x${h.quantity}` : '—';
  const right = h.market_value != null
    ? fmtMoney(h.market_value)
    : h.weight_pct != null
      ? `${Math.round(h.weight_pct)}%`
      : '—';
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

const VERDICT_TONE = {
  Healthy:       { color: '#16A34A', label: 'พอร์ตสุขภาพดี' },
  Watch:         { color: '#D97706', label: 'ควรเฝ้าดู' },
  Concentrated:  { color: '#DC2626', label: 'กระจุกตัวสูง' },
};

const CONCENTRATION_TONE = {
  low:    { color: '#16A34A', label: 'ต่ำ' },
  medium: { color: '#D97706', label: 'ปานกลาง' },
  high:   { color: '#DC2626', label: 'สูง' },
};

export function portfolioAnalysisCard(analysis) {
  const verdict = analysis.verdict || 'Watch';
  const tone = VERDICT_TONE[verdict] || VERDICT_TONE.Watch;
  const m = analysis.metrics || {};
  const conc = CONCENTRATION_TONE[m.concentration] || CONCENTRATION_TONE.medium;
  const sectors = (analysis.sectors || []).slice(0, 5);
  const observations = (analysis.observations || []).slice(0, 4);
  const watch = (analysis.watch || []).slice(0, 3);

  const body = [
    {
      type: 'box',
      layout: 'vertical',
      backgroundColor: tone.color + '14',
      cornerRadius: '8px',
      paddingAll: '12px',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: tone.label, weight: 'bold', size: 'md', color: tone.color, flex: 3 },
            { type: 'text', text: verdict, size: 'xs', color: tone.color, align: 'end', flex: 2 },
          ],
        },
        ...(analysis.verdict_reason
          ? [{ type: 'text', text: analysis.verdict_reason, wrap: true, size: 'xs', color: '#475569' }]
          : []),
      ],
    },
  ];

  const metricItems = [];
  if (m.top_symbol) {
    metricItems.push(
      metricBox(
        'หุ้นน้ำหนักสูงสุด',
        `${m.top_symbol}${m.top_weight_pct != null ? ` · ${Math.round(m.top_weight_pct)}%` : ''}`,
        '#0F172A',
      ),
    );
  }
  if (m.sector_count != null) {
    metricItems.push(metricBox('จำนวนกลุ่ม', String(m.sector_count), '#0F172A'));
  }
  metricItems.push(metricBox('ความเสี่ยงกระจุกตัว', conc.label, conc.color));

  body.push({
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    margin: 'md',
    contents: metricItems,
  });

  if (sectors.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'กลุ่มอุตสาหกรรม', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const s of sectors) {
      body.push(sectorRow(s));
    }
  }

  if (observations.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'ข้อสังเกต', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const o of observations) {
      body.push({ type: 'text', text: '• ' + o, wrap: true, size: 'xs', color: '#1E293B' });
    }
  }

  if (watch.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'ควรเฝ้าดู', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const w of watch) {
      body.push({ type: 'text', text: '• ' + w, wrap: true, size: 'xs', color: '#1E293B' });
    }
  }

  return {
    type: 'flex',
    altText: 'วิเคราะห์พอร์ต',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('วิเคราะห์พอร์ต', tone.label),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน',
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

function metricBox(label, value, valueColor) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#475569', flex: 3 },
      { type: 'text', text: value || '—', size: 'sm', weight: 'bold', color: valueColor || '#0F172A', align: 'end', flex: 2 },
    ],
  };
}

function sectorRow(s) {
  const name = s.name || '?';
  const pct = s.weight_pct != null ? `${Math.round(s.weight_pct)}%` : '—';
  const widthPct = s.weight_pct != null ? Math.max(2, Math.min(100, Math.round(s.weight_pct))) : 0;
  const bar = widthPct > 0
    ? {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#E2E8F0',
        height: '4px',
        margin: 'xs',
        cornerRadius: '2px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#0EA5E9',
            width: `${widthPct}%`,
            height: '4px',
            cornerRadius: '2px',
            contents: [{ type: 'filler' }],
          },
        ],
      }
    : null;
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'sm',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: name, size: 'xs', color: '#1E293B', flex: 5 },
          { type: 'text', text: pct, size: 'xs', color: '#475569', align: 'end', flex: 2 },
        ],
      },
      ...(bar ? [bar] : []),
    ],
  };
}

const ACTION_TONE = {
  Trim:  { color: '#DC2626', label: 'ลดน้ำหนัก' },
  Add:   { color: '#16A34A', label: 'ทยอยเพิ่ม' },
  Hold:  { color: '#0EA5E9', label: 'ถือ' },
  Watch: { color: '#D97706', label: 'เฝ้าดู' },
};

export function portfolioRebalanceCard(rebalance) {
  const suggestions = (rebalance.suggestions || []).slice(0, 8);
  const diversifiers = (rebalance.diversifiers || []).slice(0, 3);
  const risks = (rebalance.risk_notes || []).slice(0, 3);

  const body = [];

  if (rebalance.summary) {
    body.push({
      type: 'text',
      text: rebalance.summary,
      wrap: true,
      weight: 'bold',
      size: 'sm',
      color: '#0F172A',
    });
  }
  if (rebalance.rationale) {
    body.push({
      type: 'text',
      text: rebalance.rationale,
      wrap: true,
      size: 'xs',
      color: '#475569',
    });
  }

  if (suggestions.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'แนะนำต่อตัว', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const s of suggestions) body.push(rebalanceRow(s));
  }

  if (diversifiers.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'หุ้นช่วยกระจายความเสี่ยง', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const d of diversifiers) {
      body.push({
        type: 'box',
        layout: 'vertical',
        margin: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: d.symbol || '?', size: 'sm', weight: 'bold', color: '#0F172A', flex: 2 },
              { type: 'text', text: d.sector || '—', size: 'xs', color: '#475569', align: 'end', flex: 3 },
            ],
          },
          ...(d.reason
            ? [{ type: 'text', text: d.reason, wrap: true, size: 'xs', color: '#475569' }]
            : []),
        ],
      });
    }
  }

  if (risks.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'ข้อควรระวัง', weight: 'bold', size: 'sm', color: '#DC2626', margin: 'md' });
    for (const r of risks) {
      body.push({ type: 'text', text: '• ' + r, wrap: true, size: 'xs', color: '#DC2626' });
    }
  }

  return {
    type: 'flex',
    altText: 'แนะนำการปรับพอร์ต',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('ปรับพอร์ต', rebalance.summary || 'ข้อเสนอจาก AI'),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน · ตัดสินใจด้วยตนเองทุกครั้ง',
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

function rebalanceRow(s) {
  const tone = ACTION_TONE[s.action] || ACTION_TONE.Watch;
  const symbol = s.symbol || '?';
  const cur = s.current_weight_pct != null ? `${Math.round(s.current_weight_pct)}%` : '—';
  const tgt = s.target_weight_pct != null ? `${Math.round(s.target_weight_pct)}%` : '—';
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'sm',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: symbol, size: 'sm', weight: 'bold', color: '#0F172A', flex: 3 },
          { type: 'text', text: tone.label, size: 'xs', weight: 'bold', color: tone.color, align: 'end', flex: 3 },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: `ปัจจุบัน ${cur}`, size: 'xxs', color: '#94A3B8', flex: 3 },
          { type: 'text', text: `เป้าหมาย ${tgt}`, size: 'xxs', color: tone.color, align: 'end', flex: 3 },
        ],
      },
      ...(s.reason
        ? [{ type: 'text', text: s.reason, wrap: true, size: 'xs', color: '#1E293B' }]
        : []),
    ],
  };
}

export function portfolioCompareCard({ a, b, comparison }) {
  const c = comparison || {};
  const onlyA = (c.only_in_a || []).slice(0, 8);
  const onlyB = (c.only_in_b || []).slice(0, 8);
  const common = (c.common || []).slice(0, 6);
  const insights = (c.insights || []).slice(0, 3);
  const sectorDiff = (c.sector_diff || []).slice(0, 5);

  const body = [];

  if (c.summary) {
    body.push({
      type: 'text',
      text: c.summary,
      wrap: true,
      weight: 'bold',
      size: 'sm',
      color: '#0F172A',
    });
  }
  if (c.value_delta) {
    body.push({
      type: 'text',
      text: c.value_delta,
      wrap: true,
      size: 'xs',
      color: '#475569',
    });
  }

  body.push({ type: 'separator', margin: 'md' });
  body.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: a.portfolio.name || 'A', size: 'xs', weight: 'bold', color: '#0EA5E9', flex: 1 },
      { type: 'text', text: 'vs', size: 'xs', color: '#94A3B8', align: 'center', flex: 0 },
      { type: 'text', text: b.portfolio.name || 'B', size: 'xs', weight: 'bold', color: '#16A34A', align: 'end', flex: 1 },
    ],
  });

  if (onlyA.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'มีเฉพาะใน A', weight: 'bold', size: 'sm', color: '#0EA5E9', margin: 'md' });
    body.push({ type: 'text', text: onlyA.join(' · '), wrap: true, size: 'xs', color: '#1E293B' });
  }
  if (onlyB.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'มีเฉพาะใน B', weight: 'bold', size: 'sm', color: '#16A34A', margin: 'md' });
    body.push({ type: 'text', text: onlyB.join(' · '), wrap: true, size: 'xs', color: '#1E293B' });
  }
  if (common.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'มีในทั้งสอง', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const it of common) {
      body.push({
        type: 'box',
        layout: 'vertical',
        margin: 'sm',
        contents: [
          { type: 'text', text: it.symbol || '?', size: 'sm', weight: 'bold', color: '#0F172A' },
          ...(it.note
            ? [{ type: 'text', text: it.note, wrap: true, size: 'xs', color: '#475569' }]
            : []),
        ],
      });
    }
  }
  if (sectorDiff.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'กลุ่มต่างกัน', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    body.push({ type: 'text', text: '• ' + sectorDiff.join('\n• '), wrap: true, size: 'xs', color: '#1E293B' });
  }
  if (insights.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'ข้อสังเกต', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const ins of insights) {
      body.push({ type: 'text', text: '• ' + ins, wrap: true, size: 'xs', color: '#1E293B' });
    }
  }

  return {
    type: 'flex',
    altText: 'เปรียบเทียบพอร์ต',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('เปรียบเทียบพอร์ต', `${a.portfolio.name || 'A'} vs ${b.portfolio.name || 'B'}`),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน',
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

export function portfolioListCard(portfolios) {
  const rows = (portfolios || []).slice(0, 8).map((p) => portfolioListRow(p));
  const tail = (portfolios || []).length > 8
    ? [{ type: 'text', text: `+ อีก ${portfolios.length - 8} พอร์ต`, size: 'xs', color: '#94A3B8', margin: 'sm' }]
    : [];

  return {
    type: 'flex',
    altText: 'พอร์ตทั้งหมดของคุณ',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('พอร์ตทั้งหมด', `${(portfolios || []).length} รายการ`),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: rows.length
          ? [...rows, ...tail]
          : [{ type: 'text', text: '— ยังไม่มีพอร์ตที่บันทึกไว้ —', size: 'sm', color: '#94A3B8', align: 'center' }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'แตะ "เลือก" เพื่อตั้งเป็นพอร์ตที่ใช้งาน',
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

function portfolioListRow(p) {
  const isActive = p.is_active === 1 || p.is_active === true;
  const meta = [];
  if (p.source) meta.push(p.source);
  if (p.total_value != null) meta.push(fmtMoney(p.total_value));
  const metaLine = meta.join(' · ') || '—';

  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '10px',
    cornerRadius: '8px',
    backgroundColor: isActive ? '#0EA5E914' : '#F1F5F9',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: p.name || 'พอร์ต', size: 'sm', weight: 'bold', color: '#0F172A', flex: 5 },
          ...(isActive
            ? [{ type: 'text', text: 'ใช้งานอยู่', size: 'xxs', weight: 'bold', color: '#0EA5E9', align: 'end', flex: 3 }]
            : []),
        ],
      },
      { type: 'text', text: metaLine, size: 'xs', color: '#475569' },
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        margin: 'sm',
        contents: [
          {
            type: 'button',
            style: isActive ? 'secondary' : 'primary',
            color: isActive ? undefined : '#0EA5E9',
            height: 'sm',
            flex: 3,
            action: {
              type: 'postback',
              label: isActive ? 'กำลังใช้' : 'เลือก',
              data: `action=select-portfolio&id=${p.id}`,
              displayText: `เลือก ${p.name || 'พอร์ต'}`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            flex: 2,
            action: {
              type: 'postback',
              label: 'ลบ',
              data: `action=delete-portfolio&id=${p.id}`,
              displayText: `ลบ ${p.name || 'พอร์ต'}`,
            },
          },
        ],
      },
    ],
  };
}
