// Flex cards for the DCA-log wizard (started by tapping "บันทึก DCA เดือนนี้"
// on the goal card or any nudge card). Three steps:
//
//   1. amountAskCard       — ask "how much did you DCA?" with quick chips,
//                            plus a hint that the user can upload a slip
//   2. allocationAskCard   — ask "split how?" with 4 options
//                            (auto-split per plan / Thai only / global ETF
//                             only / cash only)
//   3. dcaLogResultCard    — confirm what got logged with the per-class
//                            breakdown
//
// All replies are Flex by design — no actionAckCard fallbacks, per user
// request.

import { ASSET_CLASSES } from '../assetclass.js';

export function amountAskCard({ plannedAmountThb, isOverride, ym }) {
  const planned = Number(plannedAmountThb) || 0;
  // Compose a few useful quick-pick amounts. "ตามแผน" + the planned figure
  // is the most common; the others give the user a one-tap escape if they
  // contributed less than planned this month.
  const quickAmounts = [];
  if (planned > 0) {
    quickAmounts.push({ label: `ตามแผน · ฿${fmtThb(planned)}`, value: planned, accent: '#0EA5E9' });
  }
  // Common round-number escapes — adapt to scale of the planned amount.
  if (planned >= 50000) {
    quickAmounts.push({ label: '฿10,000', value: 10000 });
    quickAmounts.push({ label: '฿30,000', value: 30000 });
  } else if (planned >= 10000) {
    quickAmounts.push({ label: '฿5,000', value: 5000 });
    quickAmounts.push({ label: '฿15,000', value: 15000 });
  } else {
    quickAmounts.push({ label: '฿1,000', value: 1000 });
    quickAmounts.push({ label: '฿5,000', value: 5000 });
  }

  return {
    type: 'flex',
    altText: `บันทึก DCA · ${ym}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand(
        '💸 บันทึก DCA เดือนนี้',
        isOverride
          ? `เดือน ${ym} · ใช้ยอด override`
          : `เดือน ${ym} · ใช้ยอดตามแผน`,
      ),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#0EA5E912',
            cornerRadius: '10px',
            paddingAll: '14px',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'จำนวนตามแผน', size: 'xs', color: '#475569' },
              { type: 'text', text: `฿${fmtThb(planned)}`, size: 'xxl', weight: 'bold', color: '#0F172A' },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'เดือนนี้คุณเติมจริงเท่าไหร่?',
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            margin: 'md',
          },
          {
            type: 'text',
            text: 'เลือกจากด้านล่าง / พิมพ์จำนวนเอง / ส่งภาพ slip โอนเงินหรือซื้อกองทุน',
            wrap: true,
            size: 'xxs',
            color: '#475569',
          },
          ...quickAmounts.map((q) => ({
            type: 'button',
            style: 'primary',
            color: q.accent || '#475569',
            height: 'sm',
            margin: 'sm',
            action: {
              type: 'postback',
              label: q.label,
              data: `action=dca-log-amount&v=${Math.round(q.value)}`,
              displayText: `เติม ฿${fmtThb(q.value)}`,
            },
          })),
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
              type: 'postback',
              label: 'ยกเลิก',
              data: 'action=dca-log-cancel',
              displayText: 'ยกเลิกการบันทึก',
            },
          },
          {
            type: 'text',
            text: 'พิมพ์ตัวเลขเอง: "30000" / "30K" · ส่งภาพ: slip โอน หรือใบซื้อกองทุน',
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

export function allocationAskCard({ amount, ym, allocation }) {
  const amt = Number(amount) || 0;
  // Build a "ตามแผนพอร์ต" preview showing exactly how the split will land.
  const allocLines = [];
  for (const [cls, pct] of Object.entries(allocation || {})) {
    if (Number(pct) <= 0) continue;
    const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
    const slice = Math.round(amt * Number(pct));
    allocLines.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: meta.emoji, size: 'sm', flex: 0 },
        { type: 'text', text: meta.label, size: 'xs', color: '#475569', flex: 4, margin: 'sm' },
        { type: 'text', text: `฿${fmtThb(slice)}`, size: 'xs', weight: 'bold', color: meta.color, align: 'end', flex: 3 },
      ],
    });
  }

  return {
    type: 'flex',
    altText: `แบ่งสัดส่วน DCA ฿${fmtThb(amt)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('📊 แบ่งสัดส่วนยังไง?', `DCA เดือนนี้ ฿${fmtThb(amt)}`),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: 'เลือกวิธีแบ่ง — ระบบจะแยกบันทึกเข้าแต่ละกลุ่มสินทรัพย์ตามวิธีที่เลือก',
            wrap: true,
            size: 'xs',
            color: '#475569',
          },
          { type: 'separator', margin: 'md' },
          // Auto-split preview block
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#0EA5E912',
            cornerRadius: '10px',
            paddingAll: '12px',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'ตัวเลือก A · ตามแผนพอร์ต', weight: 'bold', size: 'sm', color: '#0369A1' },
              ...allocLines,
              {
                type: 'button',
                style: 'primary',
                color: '#0EA5E9',
                height: 'sm',
                margin: 'sm',
                action: {
                  type: 'postback',
                  label: '✓ ใช้ตามแผน',
                  data: 'action=dca-log-allocation&kind=auto',
                  displayText: 'ใช้ตามแผนพอร์ต',
                },
              },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'ตัวเลือก B · เข้ากลุ่มเดียวทั้งหมด',
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            margin: 'md',
          },
          singleClassButton('thai_equity', amt),
          singleClassButton('global_etf', amt),
          singleClassButton('cash', amt),
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
              type: 'postback',
              label: 'ยกเลิก',
              data: 'action=dca-log-cancel',
              displayText: 'ยกเลิกการบันทึก',
            },
          },
        ],
      },
    },
  };
}

// Slip-confirmation card — shown when Claude vision identifies BOTH the
// amount AND the asset class from the uploaded slip / buy confirmation.
// One-tap "บันทึก" goes straight to the same single-class allocation
// postback the manual flow uses.
//
//   amount         — the parsed amount in THB
//   ym             — current Bangkok year-month
//   suggestedClass — asset_class detected from the slip
//   symbol         — ticker / fund name if visible (string|null)
//   description    — short description from vision ('ซื้อกองทุน KFUSA' etc.)
export function dcaSlipConfirmCard({ amount, ym, suggestedClass, symbol, description }) {
  const amt = Number(amount) || 0;
  const meta = ASSET_CLASSES[suggestedClass] || ASSET_CLASSES.other;
  const symBadge = symbol ? `${meta.emoji} ${symbol}` : `${meta.emoji} ${meta.label}`;
  const detailLines = [
    { type: 'text', text: 'จำนวนเงิน', size: 'xxs', color: '#475569' },
    { type: 'text', text: `฿${fmtThb(amt)}`, size: 'xxl', weight: 'bold', color: '#0F172A' },
    { type: 'text', text: 'บอท อ่านได้ว่า', size: 'xxs', color: '#475569', margin: 'md' },
    { type: 'text', text: symBadge, size: 'lg', weight: 'bold', color: meta.color, wrap: true },
    { type: 'text', text: `กลุ่ม: ${meta.label}`, size: 'xs', color: '#475569' },
  ];
  if (description) {
    detailLines.push({ type: 'text', text: `· ${description}`, size: 'xxs', color: '#94A3B8', wrap: true });
  }

  return {
    type: 'flex',
    altText: `ยืนยัน DCA ฿${fmtThb(amt)} เข้า ${meta.label}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('🔎 อ่านสลิปได้แล้ว', `เดือน ${ym} · ยืนยันก่อนบันทึก`),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: meta.color + '14',
            cornerRadius: '10px',
            paddingAll: '14px',
            spacing: 'xs',
            contents: detailLines,
          },
          {
            type: 'text',
            text: 'ถ้าถูกต้อง แตะปุ่มสีน้ำเงินด้านล่างเพื่อบันทึกเข้ากลุ่มนี้เลย',
            size: 'xxs',
            color: '#475569',
            wrap: true,
            margin: 'md',
          },
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
            color: meta.color,
            height: 'sm',
            action: {
              type: 'postback',
              label: `✓ บันทึกเข้า ${meta.label}`,
              data: `action=dca-log-allocation&kind=single&class=${suggestedClass}`,
              displayText: `บันทึก DCA ฿${fmtThb(amt)} เข้า ${meta.label}`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'เลือกกลุ่มอื่น / แบ่งตามแผน',
              data: 'action=dca-log-pick-class',
              displayText: 'เลือกกลุ่มอื่น',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'ยกเลิก',
              data: 'action=dca-log-cancel',
              displayText: 'ยกเลิกการบันทึก',
            },
          },
        ],
      },
    },
  };
}

function singleClassButton(cls, amount) {
  const meta = ASSET_CLASSES[cls] || ASSET_CLASSES.other;
  return {
    type: 'button',
    style: 'secondary',
    height: 'sm',
    margin: 'xs',
    action: {
      type: 'postback',
      label: `${meta.emoji} ${meta.label} ฿${fmtThb(amount)}`,
      data: `action=dca-log-allocation&kind=single&class=${cls}`,
      displayText: `เติม ${meta.label} ฿${fmtThb(amount)}`,
    },
  };
}

// Final confirmation card. Mirrors the data we just wrote to `contributions`
// so the user can sanity-check before walking away from the bot.
export function dcaLogResultCard({ amount, breakdown, totalThisMonth, ym, kind }) {
  const lines = [];
  for (const b of breakdown) {
    const meta = ASSET_CLASSES[b.class] || ASSET_CLASSES.other;
    lines.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: meta.emoji, size: 'sm', flex: 0 },
        { type: 'text', text: meta.label, size: 'sm', color: '#1E293B', flex: 4, margin: 'sm' },
        { type: 'text', text: `฿${fmtThb(b.amount_thb)}`, size: 'sm', weight: 'bold', color: meta.color, align: 'end', flex: 3 },
      ],
    });
  }

  return {
    type: 'flex',
    altText: `บันทึก DCA ฿${fmtThb(amount)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('✓ บันทึก DCA แล้ว', `เดือน ${ym} · ${kind === 'auto' ? 'แบ่งตามแผน' : 'กลุ่มเดียว'}`),
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
              { type: 'text', text: 'DCA ครั้งนี้', size: 'xs', color: '#475569' },
              { type: 'text', text: `฿${fmtThb(amount)}`, size: 'xxl', weight: 'bold', color: '#16A34A' },
              { type: 'text', text: `รวมเดือนนี้ ฿${fmtThb(totalThisMonth)}`, size: 'xxs', color: '#475569' },
            ],
          },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'แบ่งเข้าตามนี้', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' },
          ...lines,
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
              type: 'message',
              label: 'ดูเป้าหมาย',
              text: 'เป้าหมาย',
            },
          },
        ],
      },
    },
  };
}

// Sanity-check card shown BEFORE the allocation step when the entered amount
// looks risky: (a) it's ≥30% of the tracked portfolio (likely a typo, e.g.
// 300,000 instead of 30,000), or (b) a DCA was already logged this calendar
// month (possible duplicate entry). The user can confirm, cancel, or just
// re-type / re-upload a corrected amount.
//
// `reasons` is an array of:
//   { kind: 'large_pct', pct, netWorthThb }
//   { kind: 'duplicate', existingThisMonthThb }
export function dcaWarningCard({ amount, ym, reasons = [] }) {
  const amt = Number(amount) || 0;

  const reasonBoxes = reasons.map((r) => {
    let line;
    if (r.kind === 'large_pct') {
      line = `ยอดนี้คิดเป็น ~${Math.round(Number(r.pct) || 0)}% ของพอร์ตคุณ (฿${fmtThb(r.netWorthThb)}) — ใหญ่ผิดปกติ ลองเช็กว่าพิมพ์เกินหลักไหม เช่น ฿300,000 แทน ฿30,000`;
    } else if (r.kind === 'duplicate') {
      line = `เดือน ${ym} คุณบันทึก DCA ไปแล้วรวม ฿${fmtThb(r.existingThisMonthThb)} — รายการนี้อาจซ้ำ`;
    } else {
      line = 'ตรวจสอบความถูกต้องอีกครั้งก่อนบันทึก';
    }
    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'sm',
      contents: [
        { type: 'text', text: '•', size: 'sm', color: '#D97706', flex: 0 },
        { type: 'text', text: line, size: 'xs', color: '#1E293B', wrap: true, flex: 9 },
      ],
    };
  });

  return {
    type: 'flex',
    altText: `ตรวจสอบก่อนบันทึก DCA ฿${fmtThb(amt)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('⚠ ตรวจสอบก่อนบันทึก', `DCA ที่จะบันทึก ฿${fmtThb(amt)} · เดือน ${ym}`),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#D9770614',
            cornerRadius: '10px',
            paddingAll: '14px',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'ยอดที่จะบันทึก', size: 'xs', color: '#475569' },
              { type: 'text', text: `฿${fmtThb(amt)}`, size: 'xxl', weight: 'bold', color: '#B45309' },
            ],
          },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'สิ่งที่ควรเช็ก', weight: 'bold', size: 'sm', color: '#0F172A', margin: 'md' },
          ...reasonBoxes,
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
            color: '#D97706',
            height: 'sm',
            action: {
              type: 'postback',
              label: '✓ ยืนยัน ยอดถูกต้อง บันทึกต่อ',
              data: 'action=dca-log-confirm',
              displayText: 'ยืนยันยอด DCA',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'ยกเลิก',
              data: 'action=dca-log-cancel',
              displayText: 'ยกเลิกการบันทึก',
            },
          },
          {
            type: 'text',
            text: 'แก้ไขได้ทันที: พิมพ์จำนวนใหม่ เช่น "30000" หรือส่งภาพ slip ใหม่',
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

// Helper card for "couldn't parse amount" / "wizard expired" / etc. so the
// flow stays Flex-only as the user requested. Identical look to other
// info-style nudges; lives here to keep the DCA flow self-contained.
export function dcaLogInfoCard({ tone = 'info', title, subtitle, lines = [] }) {
  const TONE = {
    info:    { bar: '#0EA5E9', tint: '#0EA5E914', icon: 'ℹ︎' },
    warning: { bar: '#D97706', tint: '#D9770614', icon: '⚠' },
    error:   { bar: '#DC2626', tint: '#DC262614', icon: '✕' },
    success: { bar: '#16A34A', tint: '#16A34A14', icon: '✓' },
  };
  const t = TONE[tone] || TONE.info;
  const body = [
    {
      type: 'box',
      layout: 'vertical',
      backgroundColor: t.tint,
      cornerRadius: '10px',
      paddingAll: '12px',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            { type: 'text', text: t.icon, size: 'lg', color: t.bar, flex: 0 },
            { type: 'text', text: title, size: 'md', weight: 'bold', color: t.bar, wrap: true, flex: 5 },
          ],
        },
        ...(subtitle
          ? [{ type: 'text', text: subtitle, size: 'xs', color: '#475569', wrap: true, margin: 'sm' }]
          : []),
      ],
    },
  ];
  if (lines.length) {
    body.push({ type: 'separator', margin: 'md' });
    for (const line of lines) {
      body.push({ type: 'text', text: String(line), size: 'sm', color: '#1E293B', wrap: true });
    }
  }
  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
    },
  };
}

function heroBand(title, subtitle) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0F172A',
    paddingAll: '20px',
    contents: [
      { type: 'text', text: title, color: '#F8FAFC', weight: 'bold', size: 'lg', wrap: true },
      ...(subtitle
        ? [{ type: 'text', text: subtitle, color: '#94A3B8', size: 'xs', margin: 'sm', wrap: true }]
        : []),
    ],
  };
}

function fmtThb(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
