const LINE_CONTENT = 'https://api-data.line.me/v2/bot/message';
const ANTHROPIC_DIRECT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_BYTES = 5 * 1024 * 1024;

const EXTRACT_PROMPT = `คุณคือผู้ช่วยอ่านภาพ "หน้าจอพอร์ตการลงทุน" ของผู้ใช้ ส่วนใหญ่มาจากแอปโบรกเกอร์ไทย เช่น Streaming, KGI, FinansiaHero, Liberator
ภาษาบนภาพอาจเป็นไทยหรืออังกฤษ ตัวเลขใช้ , เป็นตัวคั่นพัน

ตอบกลับเป็น JSON เพียงอย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:
{
  "source": "Streaming|KGI|FinansiaHero|Liberator|Other",
  "total_value": <ตัวเลข มูลค่าพอร์ตรวม หรือ null ถ้าไม่เห็น>,
  "cash": <ตัวเลขเงินสด หรือ null>,
  "holdings": [
    {
      "symbol": "<ตัวย่อหุ้น เช่น PTT, AOT, KBANK>",
      "quantity": <จำนวนหุ้น>,
      "avg_cost": <ต้นทุนเฉลี่ยต่อหุ้น หรือ null>,
      "market_price": <ราคาตลาดต่อหุ้น หรือ null>,
      "market_value": <มูลค่าตลาด หรือ null>,
      "unrealized_pl": <กำไร/ขาดทุนยังไม่รับรู้ หรือ null>,
      "weight_pct": <% น้ำหนักในพอร์ต หรือ null>
    }
  ],
  "warnings": [<รายการคำเตือน ถ้าตัวเลขดูไม่ครบ/อ่านไม่ออก>]
}

กฎ:
- ถ้าไม่ใช่ภาพพอร์ตหุ้น ให้ตอบ {"error": "not_portfolio", "reason": "<สั้นๆ>"}
- ห้ามเดาตัวเลขที่อ่านไม่ออก ใช้ null และระบุใน warnings
- symbol ต้องเป็นตัวพิมพ์ใหญ่ทั้งหมด`;

export async function fetchLineImage(env, messageId) {
  const res = await fetch(`${LINE_CONTENT}/${encodeURIComponent(messageId)}/content`, {
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`LINE content ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(`image too large: ${buf.byteLength}`);
  }
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { bytes: buf, mimeType };
}

export async function extractPortfolio(env, bytes, mimeType) {
  const url = env.AI_GATEWAY_URL && env.AI_GATEWAY_URL !== 'REPLACE_WITH_YOUR_AI_GATEWAY_URL'
    ? env.AI_GATEWAY_URL.replace(/\/$/, '') + '/v1/messages'
    : ANTHROPIC_DIRECT;

  const body = {
    model: env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: normaliseMime(mimeType),
              data: toBase64(bytes),
            },
          },
          { type: 'text', text: EXTRACT_PROMPT },
        ],
      },
    ],
  };

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
    throw new Error(`vision ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw = (data.content || [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
    .trim();

  const parsed = parseJsonLoose(raw);
  if (!parsed) throw new Error('vision returned non-JSON output');
  return parsed;
}

function normaliseMime(m) {
  const v = String(m || '').toLowerCase();
  if (v.includes('png')) return 'image/png';
  if (v.includes('webp')) return 'image/webp';
  if (v.includes('gif')) return 'image/gif';
  return 'image/jpeg';
}

function toBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
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
