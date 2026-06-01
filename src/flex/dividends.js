// AIWealthOS Phase 3 — dividend Flex cards.

import { ASSET_CLASSES } from '../assetclass.js';

// Confirmation shown immediately after the user logs a dividend with
// "ปันผล <SYM> <amount>". Carries reinvest CTAs that point at the existing
// goal-DCA flow so dividends close back into the wealth-OS loop.
export function dividendConfirmCard({ result, hasActiveGoal }) {
  const amount = Number(result.amountThb) || 0;
  const symbol = result.symbol || '?';

  return {
    type: 'flex',
    altText: `บันทึกปันผล ${symbol} ${amount.toLocaleString('en-US')} บาท`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('💰 บันทึกปันผลแล้ว', `${symbol} · ${amount.toLocaleString('en-US')} บาท`),
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
              { type: 'text', text: `ปันผลจาก ${symbol}`, size: 'xs', color: '#475569' },
              {
                type: 'text',
                text: amount.toLocaleString('en-US') + ' บาท',
                size: 'xxl',
                weight: 'bold',
                color: '#16A34A',
              },
              ...(result.perShare != null && result.quantity != null
                ? [{ type: 'text', text: `${result.perShare} × ${result.quantity}`, size: 'xxs', color: '#94A3B8' }]
                : []),
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'ทำอะไรกับเงินปันผลนี้ดี?',
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            margin: 'md',
          },
          {
            type: 'text',
            text: hasActiveGoal
              ? 'สามสิ่งที่นักลงทุนระยะยาวมักทำกับปันผล — เลือกที่เข้ากับสไตล์คุณ'
              : 'ตั้งเป้าหมายก่อนแล้วบอท จะช่วยแนะนำการรีอินเวสได้ตรงแผนมากขึ้น',
            wrap: true,
            size: 'xs',
            color: '#475569',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(hasActiveGoal
            ? [{
                type: 'button',
                style: 'primary',
                color: '#16A34A',
                height: 'sm',
                action: {
                  type: 'message',
                  label: '🔄 รีอินเวสตามแผน DCA',
                  text: `เติม ${Math.round(amount)}`,
                },
              }]
            : [{
                type: 'button',
                style: 'primary',
                color: '#16A34A',
                height: 'sm',
                action: {
                  type: 'message',
                  label: '🎯 ตั้งเป้าหมายก่อน',
                  text: 'ตั้งเป้าหมาย',
                },
              }]),
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: `🔁 รีอินเวสกลับ ${symbol}`,
              text: `ซื้อ ${symbol} 1 @ ${Math.round(amount)}`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ดูรายการปันผลทั้งหมด',
              text: 'รายการปันผล',
            },
          },
          {
            type: 'text',
            text: 'การรีอินเวสเป็นการบันทึกในระบบเท่านั้น · ระบบไม่ส่งคำสั่งซื้อขายจริง',
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

// "รายการปันผล" — list of recent dividends + YTD summary.
export function dividendsListCard({ dividends, ytd, allTimeTotal }) {
  const rows = (dividends || []).slice(0, 12).map(dividendRow);
  const ytdAmount = Number(ytd?.total) || 0;
  const ytdYear = ytd?.year || new Date().getUTCFullYear();
  const topBySymbol = (ytd?.by_symbol || []).slice(0, 4);

  const body = [];

  body.push({
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#16A34A14',
    cornerRadius: '10px',
    paddingAll: '14px',
    spacing: 'xs',
    contents: [
      { type: 'text', text: `ปันผลปี ${ytdYear}`, size: 'xs', color: '#475569' },
      { type: 'text', text: ytdAmount.toLocaleString('en-US') + ' บาท', size: 'xxl', weight: 'bold', color: '#16A34A' },
      {
        type: 'text',
        text: `${ytd?.count || 0} รายการ · สะสมตลอดชีวิต ${(Number(allTimeTotal) || 0).toLocaleString('en-US')} บาท`,
        size: 'xxs',
        color: '#475569',
      },
    ],
  });

  if (topBySymbol.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: 'ตัวจ่ายปันผลเด่นปีนี้', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
    for (const r of topBySymbol) {
      body.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        contents: [
          { type: 'text', text: r.symbol, size: 'sm', weight: 'bold', color: '#0F172A', flex: 4 },
          { type: 'text', text: r.total.toLocaleString('en-US') + ' บาท', size: 'sm', color: '#16A34A', align: 'end', flex: 4 },
        ],
      });
    }
  }

  body.push({ type: 'separator', margin: 'md' });
  body.push({ type: 'text', text: 'รายการล่าสุด', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' });
  if (rows.length) {
    body.push(...rows);
  } else {
    body.push({
      type: 'text',
      text: '— ยังไม่มีรายการปันผล —\nพิมพ์ "ปันผล <SYM> <จำนวน>" เพื่อเริ่มบันทึก',
      size: 'sm',
      color: '#94A3B8',
      align: 'center',
      wrap: true,
    });
  }

  return {
    type: 'flex',
    altText: `รายการปันผล · YTD ${ytdAmount.toLocaleString('en-US')} บาท`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('💵 ปันผลในพอร์ต', `รายการล่าสุด · ${dividends?.length || 0} ครั้ง`),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์ "ปันผล <SYM> <จำนวน>" เพื่อบันทึก · หรือ "ปันผล PTT 2.15 100" สำหรับต่อหุ้น × จำนวน',
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

function dividendRow(d) {
  const amount = Number(d.amount_thb) || 0;
  const dt = d.pay_date
    ? new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        calendar: 'gregory',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(Number(d.pay_date) * 1000))
    : '';
  const subtitle = d.per_share != null && d.quantity != null
    ? `${d.per_share} × ${d.quantity}`
    : (d.withholding_tax_thb > 0 ? `หัก ณ ที่จ่าย ${Number(d.withholding_tax_thb).toLocaleString('en-US')}` : '');
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    margin: 'sm',
    paddingAll: '8px',
    cornerRadius: '6px',
    backgroundColor: '#F8FAFC',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        flex: 4,
        contents: [
          { type: 'text', text: d.symbol || '?', size: 'sm', weight: 'bold', color: '#0F172A' },
          { type: 'text', text: subtitle || dt, size: 'xxs', color: '#94A3B8', wrap: true },
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        flex: 4,
        contents: [
          {
            type: 'text',
            text: '+' + amount.toLocaleString('en-US'),
            size: 'sm',
            weight: 'bold',
            color: '#16A34A',
            align: 'end',
          },
          ...(subtitle ? [{ type: 'text', text: dt, size: 'xxs', color: '#94A3B8', align: 'end' }] : []),
        ],
      },
    ],
  };
}

function heroBand(title, subtitle) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0F172A',
    paddingAll: '20px',
    contents: [
      { type: 'text', text: title, color: '#F8FAFC', weight: 'bold', size: 'lg' },
      ...(subtitle
        ? [{ type: 'text', text: subtitle, color: '#94A3B8', size: 'xs', margin: 'sm', wrap: true }]
        : []),
    ],
  };
}
