export function portfolioConfirmCard(extracted, activePortfolio) {
  const holdings = (extracted.holdings || []).slice(0, 10);
  const warnings = extracted.warnings || [];
  const rows = holdings.map((h) => holdingRow(h, false));
  const tail = (extracted.holdings || []).length > 10
    ? [{ type: 'text', text: `+ อีก ${extracted.holdings.length - 10} ตัว`, size: 'xs', color: '#94A3B8', margin: 'sm' }]
    : [];

  const updateButton = activePortfolio
    ? [{
        type: 'button',
        style: 'primary',
        color: '#0EA5E9',
        action: {
          type: 'postback',
          label: `อัพเดต "${(activePortfolio.name || 'พอร์ต').slice(0, 20)}"`,
          data: `action=update-portfolio&id=${activePortfolio.id}`,
          displayText: `อัพเดต "${(activePortfolio.name || 'พอร์ต').slice(0, 20)}"`,
        },
      }]
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
              label: 'บันทึกเป็นพอร์ตใหม่',
              data: 'action=confirm-portfolio',
              displayText: 'บันทึกเป็นพอร์ตใหม่',
            },
          },
          ...updateButton,
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

const STATUS_TONE = {
  Hold:  { color: '#475569', label: 'ถือ' },
  Watch: { color: '#0EA5E9', label: 'เฝ้าดู' },
  Add:   { color: '#16A34A', label: 'ทยอยเพิ่ม' },
  Trim:  { color: '#D97706', label: 'ทยอยลด' },
  Alert: { color: '#DC2626', label: 'แจ้งเตือน' },
};

export function holdingsStatusCard({ portfolioName, items, asOf }) {
  const rows = (items || []).slice(0, 12).map((it) => statusRow(it));
  return {
    type: 'flex',
    altText: 'สถานะหุ้นในพอร์ต',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('สถานะหุ้น', portfolioName ? `${portfolioName}${asOf ? ' · ' + asOf : ''}` : (asOf || '')),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: rows.length
          ? rows
          : [{ type: 'text', text: '— ไม่มีข้อมูล —', size: 'sm', color: '#94A3B8', align: 'center' }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ราคาจาก Yahoo Finance อาจดีเลย์ 15-20 นาที · ข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน',
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

function statusRow(it) {
  const tone = STATUS_TONE[it.action] || STATUS_TONE.Watch;
  const dayPct = it.day_change_pct;
  const dayColor = dayPct == null ? '#475569' : dayPct >= 0 ? '#16A34A' : '#DC2626';
  const dayText = dayPct == null
    ? (it.has_quote ? '—' : 'no live')
    : `${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}%`;

  const plPct = it.pl_pct;
  const plColor = plPct == null ? '#475569' : plPct >= 0 ? '#16A34A' : '#DC2626';
  const plText = plPct == null ? '—' : `${plPct >= 0 ? '+' : ''}${plPct.toFixed(1)}%`;

  const priceText = it.current_price != null
    ? Number(it.current_price).toLocaleString('en-US', { maximumFractionDigits: 2 })
    : '—';

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'sm',
    paddingAll: '8px',
    cornerRadius: '6px',
    backgroundColor: '#F8FAFC',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: it.symbol || '?', size: 'sm', weight: 'bold', color: '#0F172A', flex: 3 },
          { type: 'text', text: tone.label, size: 'xs', weight: 'bold', color: tone.color, align: 'end', flex: 3 },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: priceText, size: 'xs', color: '#475569', flex: 2 },
          { type: 'text', text: dayText, size: 'xs', color: dayColor, align: 'center', flex: 2 },
          { type: 'text', text: `P/L ${plText}`, size: 'xs', color: plColor, align: 'end', flex: 2 },
        ],
      },
      ...(it.rationale
        ? [{ type: 'text', text: it.rationale, wrap: true, size: 'xs', color: '#1E293B' }]
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

const TX_TONE = {
  BUY:  { color: '#16A34A', label: 'ซื้อ' },
  SELL: { color: '#DC2626', label: 'ขาย' },
};

export function transactionConfirmCard({ result, portfolioName }) {
  const tone = TX_TONE[result.side] || TX_TONE.BUY;
  const isBuy = result.side === 'BUY';

  const total = Number(result.total) || 0;
  const qty = Number(result.quantity) || 0;
  const px  = Number(result.price) || 0;
  const fees = Number(result.fees) || 0;

  const body = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: result.symbol || '?', size: 'xl', weight: 'bold', color: '#0F172A', flex: 3 },
        {
          type: 'box',
          layout: 'vertical',
          flex: 2,
          backgroundColor: tone.color,
          cornerRadius: '6px',
          paddingAll: '6px',
          contents: [
            { type: 'text', text: tone.label, size: 'sm', weight: 'bold', color: '#FFFFFF', align: 'center' },
          ],
        },
      ],
    },
    { type: 'separator', margin: 'md' },
    kv('จำนวน', fmtQty(qty) + ' หุ้น'),
    kv('ราคา', fmtMoney(px)),
    ...(fees > 0 ? [kv('ค่าธรรมเนียม', fmtMoney(fees))] : []),
    kv(isBuy ? 'รวมเงินที่จ่าย' : 'รวมเงินที่ได้รับ', fmtMoney(total)),
  ];

  if (!isBuy && result.realized_pl != null) {
    const pl = Number(result.realized_pl);
    const plColor = pl >= 0 ? '#16A34A' : '#DC2626';
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: 'กำไร / ขาดทุนที่รับรู้', size: 'sm', color: '#475569', flex: 3 },
        {
          type: 'text',
          text: `${pl >= 0 ? '+' : ''}${fmtMoney(pl)}`,
          size: 'sm',
          weight: 'bold',
          color: plColor,
          align: 'end',
          flex: 2,
        },
      ],
    });
    if (result.avg_cost != null) {
      body.push({
        type: 'text',
        text: `เทียบกับต้นทุนเฉลี่ย ${fmtMoney(result.avg_cost)}`,
        size: 'xxs',
        color: '#94A3B8',
      });
    }
  }

  body.push({ type: 'separator', margin: 'md' });
  const pos = result.position || {};
  if (pos.quantity > 0) {
    body.push({ type: 'text', text: 'สถานะหลังทำรายการ', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    body.push(kv('คงเหลือ', `${fmtQty(pos.quantity)} หุ้น`));
    if (pos.avg_cost) body.push(kv('ต้นทุนเฉลี่ย', fmtMoney(pos.avg_cost)));
  } else {
    body.push({
      type: 'text',
      text: 'ปิดสถานะทั้งหมดแล้ว',
      size: 'sm',
      color: '#475569',
      align: 'center',
      margin: 'md',
    });
  }

  return {
    type: 'flex',
    altText: `${tone.label} ${result.symbol} ${fmtQty(qty)} @ ${fmtMoney(px)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero(
        `บันทึกรายการ${tone.label}เรียบร้อย`,
        portfolioName ? `พอร์ต: ${portfolioName}` : '',
      ),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
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
              type: 'postback',
              label: 'ดูรายการซื้อขายทั้งหมด',
              data: 'action=list-transactions',
              displayText: 'รายการซื้อขาย',
            },
          },
          {
            type: 'text',
            text: 'ราคาและจำนวนตามที่ผู้ใช้ระบุ ระบบไม่ได้ส่งคำสั่งซื้อขายจริง',
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

export function transactionsImportConfirmCard({ extracted, portfolioName }) {
  const all = extracted.transactions || [];
  // Three buckets — surfaced separately so the user sees exactly what gets
  // imported and what gets skipped (and why).
  const ready = all.filter(
    (t) => t.status !== 'processing' && t.quantity != null && t.price != null,
  );
  const pending = all.filter((t) => t.status === 'processing');
  const incomplete = all.filter(
    (t) => t.status !== 'processing' && (t.quantity == null || t.price == null),
  );

  const body = [
    {
      type: 'text',
      text: portfolioName ? `จะบันทึกเข้าพอร์ต: ${portfolioName}` : 'ยังไม่มีพอร์ตที่ใช้งาน',
      size: 'xs',
      color: '#475569',
      wrap: true,
    },
  ];

  if (ready.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: `พร้อมบันทึก (${ready.length})`,
      weight: 'bold',
      size: 'sm',
      color: '#16A34A',
      margin: 'md',
    });
    for (const t of ready.slice(0, 10)) body.push(importRow(t, 'ready'));
    if (ready.length > 10) {
      body.push({
        type: 'text',
        text: `+ อีก ${ready.length - 10} รายการ`,
        size: 'xs',
        color: '#94A3B8',
        margin: 'sm',
      });
    }
  } else {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: '— ไม่มีรายการที่นำเข้าได้ทันที —',
      size: 'sm',
      color: '#94A3B8',
      align: 'center',
      margin: 'md',
    });
  }

  if (pending.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: `ยังประมวลผล — ข้ามไว้ก่อน (${pending.length})`,
      weight: 'bold',
      size: 'sm',
      color: '#D97706',
      margin: 'md',
    });
    for (const t of pending.slice(0, 5)) body.push(importRow(t, 'pending'));
    if (pending.length > 5) {
      body.push({
        type: 'text',
        text: `+ อีก ${pending.length - 5} รายการ`,
        size: 'xs',
        color: '#94A3B8',
      });
    }
    body.push({
      type: 'text',
      text: 'รายการที่ยัง Processing ยังไม่มีจำนวนหน่วยจริง — รอให้กลายเป็น Done แล้วส่งภาพอีกครั้ง',
      size: 'xxs',
      color: '#D97706',
      wrap: true,
      margin: 'sm',
    });
  }

  if (incomplete.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: `ข้อมูลไม่ครบ — ข้าม (${incomplete.length})`,
      weight: 'bold',
      size: 'sm',
      color: '#DC2626',
      margin: 'md',
    });
    for (const t of incomplete.slice(0, 3)) body.push(importRow(t, 'incomplete'));
  }

  if (Array.isArray(extracted.warnings) && extracted.warnings.length) {
    body.push({ type: 'separator', margin: 'md' });
    for (const w of extracted.warnings.slice(0, 3)) {
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
    altText: 'นำเข้ารายการซื้อขายจากภาพ',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero(
        'นำเข้ารายการซื้อขาย',
        `${extracted.source || 'อ่านจากภาพ'} · พบ ${all.length} รายการ`,
      ),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(ready.length && portfolioName
            ? [{
                type: 'button',
                style: 'primary',
                color: '#16A34A',
                action: {
                  type: 'postback',
                  label: `บันทึก ${ready.length} รายการ`,
                  data: 'action=confirm-transactions-import',
                  displayText: `บันทึก ${ready.length} รายการ`,
                },
              }]
            : []),
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'ยกเลิก',
              data: 'action=retry-transactions-import',
              displayText: 'ยกเลิก',
            },
          },
          {
            type: 'text',
            text: 'ระบบจะไล่ตามเวลาเก่าไปใหม่ การขายที่ไม่มีต้นทุนในพอร์ตจะถูกข้ามและรายงานให้ทราบ',
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

const ROW_TONE = {
  ready:      { bg: '#F8FAFC' },
  pending:    { bg: '#FEF3C7' },
  incomplete: { bg: '#FEE2E2' },
};

function importRow(t, kind = 'ready') {
  const tone = TX_TONE[String(t.side || '').toUpperCase()] || TX_TONE.BUY;
  const rowTone = ROW_TONE[kind] || ROW_TONE.ready;
  const qty = t.quantity != null ? fmtQty(Number(t.quantity)) : '—';
  const px  = t.price != null ? fmtMoney(Number(t.price)) : null;
  const thb = t.total_thb != null ? fmtMoney(Number(t.total_thb)) + ' THB' : null;
  const detail = px != null
    ? `${qty} × ${px}`
    : (thb || 'ยังไม่มีจำนวนหน่วย');
  const dt = t.executed_at || '';

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    paddingAll: '6px',
    cornerRadius: '6px',
    backgroundColor: rowTone.bg,
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: tone.label, size: 'xs', weight: 'bold', color: tone.color, flex: 1 },
          { type: 'text', text: t.symbol || '?', size: 'sm', weight: 'bold', color: '#0F172A', flex: 4 },
          { type: 'text', text: dt, size: 'xxs', color: '#94A3B8', align: 'end', flex: 4 },
        ],
      },
      {
        type: 'text',
        text: detail,
        size: 'xs',
        color: '#475569',
      },
    ],
  };
}

export function transactionsImportResultCard({ portfolioName, applied, skipped, errors }) {
  const lines = [
    {
      type: 'text',
      text: `บันทึกสำเร็จ ${applied?.length || 0} รายการ`,
      weight: 'bold',
      size: 'md',
      color: '#16A34A',
    },
  ];
  if (skipped?.length) {
    lines.push({
      type: 'text',
      text: `ข้าม ${skipped.length} รายการ (ข้อมูลไม่ครบ)`,
      size: 'xs',
      color: '#D97706',
    });
  }
  if (errors?.length) {
    lines.push({ type: 'separator', margin: 'sm' });
    lines.push({
      type: 'text',
      text: `ผิดพลาด ${errors.length} รายการ`,
      weight: 'bold',
      size: 'sm',
      color: '#DC2626',
    });
    for (const e of errors.slice(0, 5)) {
      const r = e.row || {};
      const reason = ERROR_LABEL[e.error] || e.error || 'unknown';
      lines.push({
        type: 'text',
        text: `• ${String(r.side || '').toUpperCase()} ${r.symbol || '?'} (${fmtQty(r.quantity)}) — ${reason}`,
        size: 'xxs',
        color: '#DC2626',
        wrap: true,
      });
    }
  }
  return {
    type: 'flex',
    altText: 'ผลการนำเข้ารายการซื้อขาย',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('นำเข้ารายการซื้อขายเรียบร้อย', portfolioName || ''),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: lines },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'ดูรายการซื้อขายทั้งหมด',
              data: 'action=list-transactions',
              displayText: 'รายการซื้อขาย',
            },
          },
        ],
      },
    },
  };
}

const ERROR_LABEL = {
  no_position: 'ไม่มีต้นทุนในพอร์ต',
  insufficient_quantity: 'จำนวนไม่พอ',
  invalid_input: 'ข้อมูลไม่ถูกต้อง',
  portfolio_not_found: 'ไม่พบพอร์ต',
};

export function transactionsListCard({ portfolioName, transactions }) {
  const rows = (transactions || []).slice(0, 12).map((t) => transactionRow(t));
  return {
    type: 'flex',
    altText: 'รายการซื้อขาย',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: hero('รายการซื้อขาย', portfolioName || ''),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: rows.length
          ? rows
          : [{ type: 'text', text: '— ยังไม่มีรายการ —', size: 'sm', color: '#94A3B8', align: 'center' }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์ "ซื้อ <SYMBOL> <จำนวน> @ <ราคา>" หรือ "ขาย ..." เพื่อบันทึกรายการ',
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

function transactionRow(t) {
  const tone = TX_TONE[t.side] || TX_TONE.BUY;
  const qty = Number(t.quantity) || 0;
  const px  = Number(t.price) || 0;
  const total = qty * px;
  const dt = t.executed_at
    ? new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(Number(t.executed_at) * 1000))
    : '';

  const plLine = t.realized_pl != null
    ? [{
        type: 'text',
        text: `P/L ${Number(t.realized_pl) >= 0 ? '+' : ''}${fmtMoney(t.realized_pl)}`,
        size: 'xxs',
        color: Number(t.realized_pl) >= 0 ? '#16A34A' : '#DC2626',
      }]
    : [];

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    paddingAll: '8px',
    cornerRadius: '6px',
    backgroundColor: '#F8FAFC',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: tone.label, size: 'xs', weight: 'bold', color: tone.color, flex: 1 },
          { type: 'text', text: t.symbol || '?', size: 'sm', weight: 'bold', color: '#0F172A', flex: 3 },
          { type: 'text', text: dt, size: 'xxs', color: '#94A3B8', align: 'end', flex: 3 },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: `${fmtQty(qty)} × ${fmtMoney(px)}`, size: 'xs', color: '#475569', flex: 3 },
          { type: 'text', text: fmtMoney(total), size: 'xs', color: '#0F172A', align: 'end', flex: 2 },
        ],
      },
      ...plLine,
    ],
  };
}

function fmtQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
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
