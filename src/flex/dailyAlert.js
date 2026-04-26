export function dailyAlertCard({ date, picks, summary }) {
  const items = (picks || []).slice(0, 5).map((p) => ({
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'md',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: p.symbol, weight: 'bold', size: 'md', color: '#0F172A', flex: 2 },
          { type: 'text', text: p.signal || '-', size: 'sm', color: signalColor(p.signal), align: 'end', flex: 3 },
        ],
      },
      { type: 'text', text: p.reason || '', wrap: true, size: 'xs', color: '#475569' },
    ],
  }));

  return {
    type: 'flex',
    altText: `FinBot Daily ${date || ''}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: 'FinBot Daily Pick', color: '#F8FAFC', weight: 'bold', size: 'lg' },
          { type: 'text', text: date || '', color: '#94A3B8', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(summary ? [{ type: 'text', text: summary, wrap: true, size: 'sm', color: '#1E293B' }] : []),
          { type: 'separator' },
          ...items,
        ],
      },
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

function signalColor(signal) {
  const s = String(signal || '').toLowerCase();
  if (s.includes('buy') || s.includes('ซื้อ')) return '#16A34A';
  if (s.includes('sell') || s.includes('ขาย')) return '#DC2626';
  return '#0EA5E9';
}
