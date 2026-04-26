const ANTHROPIC_DIRECT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT_TH = `คุณคือ "FinBot" ผู้ช่วยการเงินส่วนตัวภาษาไทยบน LINE
- ตอบเป็นภาษาไทยกระชับ เข้าใจง่าย เป็นกันเอง
- เน้นการเงินส่วนบุคคล การออม การลงทุน หุ้นไทย/ต่างประเทศ น้ำมัน เศรษฐกิจ
- ห้ามให้คำแนะนำเด็ดขาดว่า "ต้องซื้อ/ขาย" — ใช้สำนวนเชิงข้อมูล/ความเสี่ยง
- ถ้าผู้ใช้ถามนอกหัวข้อการเงิน ตอบสั้นๆ และดึงกลับเข้าเรื่องการเงิน
- หลีกเลี่ยง markdown ที่ LINE แสดงไม่ได้ (เช่น ตาราง) — ใช้ bullet ด้วย "•"`;

export async function askClaude(messages, env, opts = {}) {
  const model = env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  const body = {
    model,
    max_tokens: opts.maxTokens || 1024,
    system: opts.system || SYSTEM_PROMPT_TH,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  const url = env.AI_GATEWAY_URL && env.AI_GATEWAY_URL !== 'REPLACE_WITH_YOUR_AI_GATEWAY_URL'
    ? env.AI_GATEWAY_URL.replace(/\/$/, '') + '/v1/messages'
    : ANTHROPIC_DIRECT;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const out = (data.content || [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
    .trim();
  return out || 'ขออภัย ตอนนี้ระบบยังตอบไม่ได้ ลองใหม่อีกครั้งนะครับ';
}

export async function generatePortfolioAnalysis(env, portfolio, holdings) {
  const summary = portfolioToText(portfolio, holdings);
  const prompt = [
    {
      role: 'user',
      content:
        'วิเคราะห์พอร์ตนี้และตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:\n\n' +
        summary +
        '\n\nรูปแบบ:\n' +
        '{\n' +
        '  "verdict": "Healthy" | "Watch" | "Concentrated",\n' +
        '  "verdict_reason": "<1 ประโยคภาษาไทย สรุปทำไมถึงให้ verdict นี้>",\n' +
        '  "metrics": {\n' +
        '    "top_symbol": "<ตัวที่หนักที่สุด>",\n' +
        '    "top_weight_pct": <ตัวเลข % โดยประมาณ ถ้าไม่มี weight_pct ในข้อมูล ให้คำนวณจาก market_value/total_value>,\n' +
        '    "sector_count": <จำนวน sector คร่าวๆ>,\n' +
        '    "concentration": "low" | "medium" | "high"\n' +
        '  },\n' +
        '  "sectors": [ { "name": "<กลุ่ม เช่น ธนาคาร พลังงาน เทคโนโลยี>", "weight_pct": <ตัวเลข> } ],\n' +
        '  "observations": [ "<ข้อสังเกต 3-4 ข้อ>" ],\n' +
        '  "watch": [ "<สิ่งที่ควรเฝ้าดู 1-3 ข้อ>" ]\n' +
        '}\n\n' +
        'กฎ:\n' +
        '- ภาษาไทยทั้งหมด ยกเว้น verdict (Healthy/Watch/Concentrated) และ concentration (low/medium/high)\n' +
        '- ห้ามแนะนำ "ซื้อ/ขาย" ใช้สำนวนเชิงข้อมูล/ความเสี่ยง\n' +
        '- weight_pct เป็นตัวเลข ไม่ใช่ string\n' +
        '- ถ้าไม่ทราบ sector จริง ให้เดาจากชื่อ symbol อย่างสมเหตุสมผล',
    },
  ];
  const raw = await askClaude(prompt, env, { maxTokens: 900 });
  return parseJsonLoose(raw) || { verdict_reason: raw.slice(0, 400) };
}

export async function generatePortfolioRebalance(env, portfolio, holdings) {
  const summary = portfolioToText(portfolio, holdings);
  const prompt = [
    {
      role: 'user',
      content:
        'ดูพอร์ตนี้แล้วเสนอการ "ปรับพอร์ต" ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:\n\n' +
        summary +
        '\n\nรูปแบบ:\n' +
        '{\n' +
        '  "summary": "<1 ประโยคสรุปทิศทางการปรับ>",\n' +
        '  "rationale": "<1-2 ประโยค ทำไมถึงควรปรับตอนนี้>",\n' +
        '  "suggestions": [\n' +
        '    {\n' +
        '      "symbol": "<หุ้นที่ผู้ใช้มีอยู่>",\n' +
        '      "action": "Trim" | "Add" | "Hold" | "Watch",\n' +
        '      "current_weight_pct": <ตัวเลข % โดยประมาณ>,\n' +
        '      "target_weight_pct": <ตัวเลข % โดยประมาณ ถ้า action เป็น Hold/Watch ใส่ค่าเดิม>,\n' +
        '      "reason": "<เหตุผลสั้น 1 ประโยค>"\n' +
        '    }\n' +
        '  ],\n' +
        '  "diversifiers": [\n' +
        '    { "symbol": "<หุ้นใหม่ที่ช่วยกระจายความเสี่ยง>", "sector": "<กลุ่ม>", "reason": "<สั้น>" }\n' +
        '  ],\n' +
        '  "risk_notes": [ "<ข้อควรระวัง 1-3 ข้อ>" ]\n' +
        '}\n\n' +
        'กฎ:\n' +
        '- ภาษาไทย ยกเว้น action (Trim/Add/Hold/Watch)\n' +
        '- suggestions เน้นหุ้นที่ผู้ใช้ "มีอยู่แล้ว" (3-6 รายการ)\n' +
        '- diversifiers 1-3 รายการ เป็นหุ้นไทยที่ผู้ใช้ "ยังไม่มี"\n' +
        '- ใช้สำนวนเชิงพิจารณา ไม่ใช่คำสั่ง ("ลดน้ำหนัก", "ทยอยเพิ่ม", "เฝ้าดู") ห้ามพูด "ต้องซื้อ/ขาย"\n' +
        '- ตัวเลข weight เป็น number ไม่ใช่ string',
    },
  ];
  const raw = await askClaude(prompt, env, { maxTokens: 1100 });
  return parseJsonLoose(raw) || { rationale: raw.slice(0, 400) };
}

export async function generatePicksViaClaude(env, holdings) {
  const portfolioContext = holdings && holdings.length
    ? `ผู้ใช้ถือหุ้นเหล่านี้อยู่: ${holdings
        .map((h) => `${h.symbol}${h.weight_pct ? `(${Math.round(h.weight_pct)}%)` : ''}`)
        .join(', ')}\n\nคัดเลือกหุ้นน่าจับตา 3-5 ตัวที่ "เกี่ยวข้องกับพอร์ตนี้" — อาจเป็นหุ้นกลุ่มเดียวกันที่น่าสนใจ คู่แข่ง หรือหุ้นช่วยกระจายความเสี่ยง`
    : 'คัดเลือกหุ้นไทยน่าจับตา 3-5 ตัวสำหรับวันนี้';

  const prompt = [
    {
      role: 'user',
      content:
        portfolioContext +
        '\n\nตอบเป็น JSON เท่านั้น:\n' +
        '{ "summary": "สรุป 1 ประโยค", "picks": [ { "symbol": "XXX", "signal": "Watch|Buy|Sell|Neutral", "reason": "เหตุผลสั้น" } ] }\n' +
        'ใช้ข้อมูลพื้นฐาน/ปัจจัยมหภาคทั่วไป ไม่ใช้ราคาเรียลไทม์',
    },
  ];
  const raw = await askClaude(prompt, env, { maxTokens: 800 });
  return parseJsonLoose(raw) || { summary: raw.slice(0, 200), picks: [] };
}

function portfolioToText(portfolio, holdings) {
  const lines = [];
  if (portfolio.source) lines.push(`Source: ${portfolio.source}`);
  if (portfolio.total_value != null) lines.push(`Total value: ${portfolio.total_value}`);
  if (portfolio.cash != null) lines.push(`Cash: ${portfolio.cash}`);
  lines.push('Holdings:');
  for (const h of holdings) {
    const parts = [`- ${h.symbol}`];
    if (h.quantity != null) parts.push(`qty=${h.quantity}`);
    if (h.avg_cost != null) parts.push(`avg=${h.avg_cost}`);
    if (h.market_value != null) parts.push(`mv=${h.market_value}`);
    if (h.unrealized_pl != null) parts.push(`pl=${h.unrealized_pl}`);
    if (h.weight_pct != null) parts.push(`w=${h.weight_pct}%`);
    lines.push(parts.join(' '));
  }
  return lines.join('\n');
}

function parseJsonLoose(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}
