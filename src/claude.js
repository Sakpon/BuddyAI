const ANTHROPIC_DIRECT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT_TH = `คุณคือ "FinBot" ผู้ช่วยการเงินส่วนตัวภาษาไทยบน LINE
- ตอบเป็นภาษาไทยกระชับ เข้าใจง่าย เป็นกันเอง
- เน้นการเงินส่วนบุคคล การออม การลงทุน หุ้นไทย/ต่างประเทศ น้ำมัน เศรษฐกิจ
- ห้ามให้คำแนะนำเด็ดขาดว่า "ต้องซื้อ/ขาย" — ใช้สำนวนเชิงข้อมูล/ความเสี่ยง
- ถ้าผู้ใช้ถามนอกหัวข้อการเงิน ตอบสั้นๆ และดึงกลับเข้าเรื่องการเงิน
- หลีกเลี่ยง markdown ที่ LINE แสดงไม่ได้ (เช่น ตาราง) — ใช้ bullet ด้วย "•"`;

export async function askClaude(messages, env) {
  const model = env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  const body = {
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT_TH,
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
