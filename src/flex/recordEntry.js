// Unified "บันทึก / record" entry card — surfaces both ways to log a stock
// movement (image-upload + manual typing) so users who haven't memorized
// the `ซื้อ <SYM> <qty> @ <price>` syntax have a guided starting point.
//
// Deliberately a low-state card: it just explains and links. No new wizard,
// no new postback flow — both paths are already implemented elsewhere.

export function recordEntryCard() {
  return {
    type: 'flex',
    altText: 'บันทึกการซื้อขาย — เลือกวิธีที่สะดวก',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand(),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: 'มี 2 วิธีให้เลือก ใช้แบบไหนก็ได้ — ผลลัพธ์ปลายทางเหมือนกัน',
            wrap: true,
            size: 'sm',
            color: '#1E293B',
          },
          { type: 'separator', margin: 'md' },
          methodBlock(
            '1',
            '📷',
            'ส่งภาพหน้าจอจากแอปธนาคาร/โบรกเกอร์',
            'SCB Easy, KMA, Bualuang mBanking, Krungsri Plus, Settrade — เปิด tab "Activity / รายการซื้อขาย" แล้วส่งภาพมาเลย',
            'บอท จะแสดงทุกรายการ มีกล่อง ☑ ให้กดเลือกตัวที่อยากบันทึก แล้วกด "บันทึกทั้งหมด"',
            '#16A34A',
          ),
          methodBlock(
            '2',
            '⌨️',
            'พิมพ์เอง',
            'เร็วและตรงเป้าหมายเมื่อบันทึกครั้งเดียว',
            'รูปแบบ:\n• ซื้อ <SYMBOL> <จำนวน> @ <ราคา>\n• ขาย <SYMBOL> <จำนวน> @ <ราคา>',
            '#0EA5E9',
            [
              '✓ ซื้อ PTT 100 @ 35.50',
              '✓ ขาย AAPL 5 @ 180',
              '✓ ซื้อ KBANK 1,000 @ 145.50',
              '✓ buy 0700.HK 200 @ 320',
            ],
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
              label: 'ดูรายการที่บันทึกแล้ว',
              text: 'รายการซื้อขาย',
            },
          },
          {
            type: 'text',
            text: 'รายการที่บันทึกเป็นเพียงการเก็บสถิติ · ระบบไม่ได้ส่งคำสั่งซื้อขายจริงไปยังโบรกเกอร์',
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

function methodBlock(number, emoji, title, oneLiner, howTo, accentColor, examples) {
  const contents = [
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 0,
          backgroundColor: accentColor,
          cornerRadius: '14px',
          width: '28px',
          height: '28px',
          contents: [{
            type: 'text',
            text: number,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'sm',
            align: 'center',
            gravity: 'center',
          }],
        },
        { type: 'text', text: emoji, size: 'md', flex: 0, gravity: 'center' },
        {
          type: 'text',
          text: title,
          size: 'sm',
          weight: 'bold',
          color: '#0F172A',
          flex: 5,
          gravity: 'center',
          wrap: true,
        },
      ],
    },
    { type: 'text', text: oneLiner, wrap: true, size: 'xs', color: '#475569' },
    { type: 'text', text: howTo, wrap: true, size: 'xs', color: '#1E293B' },
  ];

  if (Array.isArray(examples) && examples.length) {
    for (const ex of examples) {
      contents.push({
        type: 'text',
        text: ex,
        size: 'xxs',
        color: '#475569',
      });
    }
  }

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'md',
    paddingAll: '10px',
    cornerRadius: '8px',
    backgroundColor: '#F8FAFC',
    contents,
  };
}

function heroBand() {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0F172A',
    paddingAll: '20px',
    contents: [
      { type: 'text', text: '📝 บันทึกการซื้อขาย', color: '#F8FAFC', weight: 'bold', size: 'lg' },
      {
        type: 'text',
        text: 'เลือกวิธีที่ถนัด — ส่งภาพหรือพิมพ์เอง',
        color: '#94A3B8',
        size: 'xs',
        margin: 'sm',
        wrap: true,
      },
    ],
  };
}
