const ACTION_TONE = {
  Positive: { color: '#16A34A', label: 'บวก' },
  Watch:    { color: '#0EA5E9', label: 'เฝ้าดู' },
  Hold:     { color: '#475569', label: 'ถือ' },
  Alert:    { color: '#DC2626', label: 'แจ้งเตือน' },
};

const STANCE_TONE = {
  Balanced:     { color: '#16A34A', label: 'สมดุล' },
  Concentrated: { color: '#D97706', label: 'กระจุก' },
  Defensive:    { color: '#0EA5E9', label: 'ระมัดระวัง' },
  Aggressive:   { color: '#DC2626', label: 'เชิงรุก' },
};

export function dailyNewsCard({ date, news, portfolioName }) {
  const items = (news?.items || []).slice(0, 5);
  const view = news?.portfolio_view || null;
  const body = [];

  if (news?.summary) {
    body.push({
      type: 'text',
      text: news.summary,
      wrap: true,
      size: 'sm',
      color: '#0F172A',
    });
  }

  // Overall portfolio recommendation — sits above the per-symbol items so
  // the user sees the cross-holding stance first.
  if (view && (view.headline || view.recommendation)) {
    body.push({ type: 'separator', margin: 'md' });
    body.push(portfolioViewBlock(view));
  }

  for (const it of items) {
    body.push({ type: 'separator', margin: 'md' });
    body.push(newsBlock(it));
  }

  if (!items.length) {
    body.push({
      type: 'text',
      text: '— ไม่มีประเด็นเด่นเช้านี้ —',
      size: 'sm',
      color: '#94A3B8',
      align: 'center',
    });
  }

  const subtitle = portfolioName ? `${portfolioName} · ${date || ''}` : (date || '');

  return {
    type: 'flex',
    altText: `ข่าวเช้า ${date || ''}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: 'ข่าวเช้าสำหรับพอร์ตคุณ', color: '#F8FAFC', weight: 'bold', size: 'lg' },
          ...(subtitle
            ? [{ type: 'text', text: subtitle, color: '#94A3B8', size: 'xs', margin: 'sm' }]
            : []),
        ],
      },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน · ตรวจสอบข่าวจากแหล่งทางการก่อนตัดสินใจ',
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

function portfolioViewBlock(view) {
  const tone = STANCE_TONE[view.stance] || STANCE_TONE.Balanced;
  const rows = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '🔭 ภาพรวมพอร์ต', size: 'sm', weight: 'bold', color: '#0F172A', flex: 5 },
        { type: 'text', text: tone.label, size: 'xs', weight: 'bold', color: tone.color, align: 'end', flex: 3 },
      ],
    },
  ];
  if (view.headline) {
    rows.push({ type: 'text', text: view.headline, wrap: true, size: 'sm', weight: 'bold', color: '#0F172A' });
  }
  if (view.rationale) {
    rows.push({ type: 'text', text: view.rationale, wrap: true, size: 'xs', color: '#475569' });
  }
  if (view.recommendation) {
    rows.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: tone.color + '14',
      paddingAll: '10px',
      cornerRadius: '6px',
      margin: 'sm',
      contents: [
        { type: 'text', text: 'คำแนะนำพอร์ตรวม', size: 'xxs', weight: 'bold', color: tone.color },
        { type: 'text', text: view.recommendation, wrap: true, size: 'xs', color: '#1E293B' },
      ],
    });
  }
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'sm',
    contents: rows,
  };
}

function newsBlock(item) {
  const tone = ACTION_TONE[item.action] || ACTION_TONE.Watch;
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
          { type: 'text', text: item.symbol || '?', size: 'sm', weight: 'bold', color: '#0F172A', flex: 2 },
          { type: 'text', text: tone.label, size: 'xs', weight: 'bold', color: tone.color, align: 'end', flex: 3 },
        ],
      },
      ...(item.headline
        ? [{ type: 'text', text: item.headline, wrap: true, size: 'sm', weight: 'bold', color: '#0F172A' }]
        : []),
      ...(item.summary
        ? [{ type: 'text', text: item.summary, wrap: true, size: 'xs', color: '#475569' }]
        : []),
      ...(item.recommendation
        ? [{
            type: 'box',
            layout: 'vertical',
            backgroundColor: tone.color + '14',
            paddingAll: '8px',
            cornerRadius: '6px',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'แนะนำ', size: 'xxs', weight: 'bold', color: tone.color },
              { type: 'text', text: item.recommendation, wrap: true, size: 'xs', color: '#1E293B' },
            ],
          }]
        : []),
    ],
  };
}
