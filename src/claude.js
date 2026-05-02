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
  const raw = await askClaude(prompt, env, { maxTokens: 1500 });
  return parseJsonLoose(raw);
}

// Per-holding "status" recommendation for the สถานะหุ้น command.
// `items` is an array of:
//   { symbol, current_price, day_change_pct, pl_pct, distance_from_52w_high_pct,
//     weight_pct, has_quote }
// Caller has already merged Yahoo Finance quotes with the user's cost basis.
export async function generateHoldingsStatus(env, items) {
  if (!items || !items.length) return null;

  const lines = items.map((it) => {
    const parts = [`- ${it.symbol}`];
    if (it.current_price != null) parts.push(`price=${it.current_price}`);
    if (it.day_change_pct != null) parts.push(`day=${it.day_change_pct.toFixed(2)}%`);
    if (it.pl_pct != null) parts.push(`pl=${it.pl_pct.toFixed(1)}%`);
    if (it.distance_from_52w_high_pct != null)
      parts.push(`vs52w_hi=${it.distance_from_52w_high_pct.toFixed(0)}%`);
    if (it.weight_pct != null) parts.push(`w=${Math.round(it.weight_pct)}%`);
    if (!it.has_quote) parts.push('no_realtime_data');
    return parts.join(' ');
  });

  const prompt = [
    {
      role: 'user',
      content:
        'นี่คือสถานะแต่ละตัวที่ผู้ใช้ถือ (รวม snapshot ราคาล่าสุดจาก Yahoo Finance):\n' +
        lines.join('\n') +
        '\n\nสำหรับแต่ละ symbol ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:\n' +
        '{\n' +
        '  "items": [\n' +
        '    {\n' +
        '      "symbol": "<symbol>",\n' +
        '      "action": "Hold" | "Watch" | "Trim" | "Add" | "Alert",\n' +
        '      "rationale": "<1 ประโยคภาษาไทยอธิบายว่าทำไมให้ action นี้>"\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'กฎ:\n' +
        '- ภาษาไทย ยกเว้น action (Hold/Watch/Trim/Add/Alert)\n' +
        '- ใช้ข้อมูล price/day/pl/vs52w_hi ที่ให้มา ไม่จำเป็นต้องเดา\n' +
        '- ห้ามแนะนำ "ซื้อ/ขาย" ตรงๆ — ใช้ "พิจารณา…", "เฝ้าดู", "ทยอย…"\n' +
        '- ทุกตัวที่อยู่ใน list ต้องมี item ตอบกลับ (ถ้า no_realtime_data ให้ Hold/Watch + rationale ว่าไม่มีข้อมูลราคา)\n' +
        '- ตอบสั้น 1500 tokens',
    },
  ];
  const raw = await askClaude(prompt, env, { maxTokens: 1800 });
  return parseJsonLoose(raw);
}

export async function generatePortfolioComparison(env, a, b) {
  // a, b: { portfolio, holdings }
  const aText = portfolioToText(a.portfolio, a.holdings);
  const bText = portfolioToText(b.portfolio, b.holdings);
  const prompt = [
    {
      role: 'user',
      content:
        'เปรียบเทียบสองพอร์ตนี้ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:\n\n' +
        `### A: ${a.portfolio.name || 'A'}\n${aText}\n\n` +
        `### B: ${b.portfolio.name || 'B'}\n${bText}\n\n` +
        'รูปแบบ:\n' +
        '{\n' +
        '  "summary": "<1-2 ประโยคสรุปความต่างหลัก>",\n' +
        '  "value_delta": "<พูดถึง total_value ของ A เทียบ B สั้นๆ>",\n' +
        '  "only_in_a": [ "<symbol>" ],\n' +
        '  "only_in_b": [ "<symbol>" ],\n' +
        '  "common": [ { "symbol": "<sym>", "note": "<ต่างกันยังไง 1 ประโยค>" } ],\n' +
        '  "sector_diff": [ "<กลุ่มอุตสาหกรรมที่ต่างกันชัด>" ],\n' +
        '  "insights": [ "<ข้อสังเกต 2-3 ข้อ ภาษาไทย>" ]\n' +
        '}\n\n' +
        'กฎ:\n' +
        '- ภาษาไทยทั้งหมด\n' +
        '- เทียบเชิงโครงสร้าง (sector, น้ำหนัก, ความเสี่ยง) ไม่ใช่เชิงพยากรณ์ราคา\n' +
        '- ห้ามแนะนำ "ซื้อ/ขาย"\n' +
        '- ตอบสั้น ไม่เกิน 1500 tokens',
    },
  ];
  const raw = await askClaude(prompt, env, { maxTokens: 1800 });
  return parseJsonLoose(raw);
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
        '- suggestions เน้นหุ้นที่ผู้ใช้ "มีอยู่แล้ว" (สูงสุด 4 รายการ)\n' +
        '- diversifiers 1-2 รายการ เป็นหุ้นไทยที่ผู้ใช้ "ยังไม่มี"\n' +
        '- risk_notes 1-2 ข้อ\n' +
        '- ใช้สำนวนเชิงพิจารณา ไม่ใช่คำสั่ง ("ลดน้ำหนัก", "ทยอยเพิ่ม", "เฝ้าดู") ห้ามพูด "ต้องซื้อ/ขาย"\n' +
        '- ตัวเลข weight เป็น number ไม่ใช่ string\n' +
        '- ตอบให้สั้นกระชับ ไม่เกิน 1500 tokens',
    },
  ];
  const raw = await askClaude(prompt, env, { maxTokens: 2000 });
  return parseJsonLoose(raw);
}

export async function generateDailyNewsForHoldings(env, holdings, headlinesBySymbol) {
  if (!holdings || !holdings.length) return null;
  const symbolList = holdings.map((h) => h.symbol).filter(Boolean).slice(0, 12).join(', ');

  // Build a real-headlines context block if the caller fetched any.
  const headlineLines = [];
  if (headlinesBySymbol && typeof headlinesBySymbol === 'object') {
    for (const [sym, items] of Object.entries(headlinesBySymbol)) {
      if (!Array.isArray(items) || !items.length) continue;
      headlineLines.push(`[${sym}]`);
      for (const it of items.slice(0, 3)) {
        const line = '- ' + (it.title || '').replace(/\s+/g, ' ').trim();
        headlineLines.push(line.slice(0, 220));
      }
    }
  }
  const headlinesBlock = headlineLines.length
    ? '\n\nหัวข้อข่าวจริงล่าสุด (จาก Yahoo Finance) ใช้เป็น "บริบท" — สรุปและตีความให้เข้ากับพอร์ต อย่าก๊อปวลีตรงๆ:\n' + headlineLines.join('\n')
    : '';

  const prompt = [
    {
      role: 'user',
      content:
        'หุ้น/ETF ที่ผู้ใช้ถือ: ' + symbolList +
        headlinesBlock + '\n\n' +
        'ในฐานะ FinBot สรุปประเด็น ข่าว/ปัจจัยมหภาค/sector themes ที่อาจกระทบราคาในวันนี้ ' +
        '(รายตัว — เลือกที่เด่นที่สุด 3-5 ตัวเท่านั้น ไม่จำเป็นต้องครบทุก symbol)\n\n' +
        'ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:\n' +
        '{\n' +
        '  "summary": "<1 ประโยคสรุปภาพรวมเช้านี้>",\n' +
        '  "items": [\n' +
        '    {\n' +
        '      "symbol": "<symbol>",\n' +
        '      "headline": "<หัวข้อสั้น 1 บรรทัด>",\n' +
        '      "summary": "<1-2 ประโยคบอกบริบท>",\n' +
        '      "action": "Watch" | "Alert" | "Positive" | "Hold",\n' +
        '      "recommendation": "<สั้น เชิงพิจารณา ไม่ใช่คำสั่งซื้อขาย>",\n' +
        '      "from_real_headline": <true ถ้าอ้างอิง Yahoo headline ด้านบน, false ถ้าเป็น sector/theme เอง>\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'กฎ:\n' +
        '- ภาษาไทย ยกเว้น action (Watch/Alert/Positive/Hold)\n' +
        '- ห้ามให้คำสั่ง "ซื้อ/ขาย" — ใช้ "เฝ้าดู", "พิจารณาลดสัดส่วน", "ติดตามผลประกอบการ"\n' +
        '- ถ้ามี real headlines ด้านบน ให้ "from_real_headline": true และอิงเนื้อหา\n' +
        '- ถ้าไม่มี ให้ "from_real_headline": false และอิง sector/macro แทน\n' +
        '- 3-5 items, เลือกที่ "อาจส่งผลวันนี้" ที่สุด\n' +
        '- ตอบสั้นกระชับ ไม่เกิน 1500 tokens',
    },
  ];
  const raw = await askClaude(prompt, env, { maxTokens: 2000 });
  return parseJsonLoose(raw);
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
  const raw = await askClaude(prompt, env, { maxTokens: 1000 });
  return parseJsonLoose(raw) || { summary: '', picks: [] };
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
  // Strip ```json ... ``` fences if present.
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}
