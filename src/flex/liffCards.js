export function stockLiffCard(env) {
  return {
    type: 'flex',
    altText: 'เปิด Stock Dashboard',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'Stock Dashboard', weight: 'bold', size: 'lg', color: '#0F172A' },
          { type: 'text', text: 'ดูราคาหุ้นเรียลไทม์ + กราฟ', size: 'sm', color: '#475569' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0EA5E9',
            action: { type: 'uri', label: 'เปิดดูหุ้น', uri: env.LIFF_STOCK_URL },
          },
        ],
      },
    },
  };
}

export function oilLiffCard(env) {
  return {
    type: 'flex',
    altText: 'เปิด Oil Price Dashboard',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'ราคาน้ำมัน', weight: 'bold', size: 'lg', color: '#0F172A' },
          { type: 'text', text: 'อัปเดตราคาน้ำมันรายวัน (TH)', size: 'sm', color: '#475569' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#16A34A',
            action: { type: 'uri', label: 'เปิดดูน้ำมัน', uri: env.LIFF_OIL_URL },
          },
        ],
      },
    },
  };
}
