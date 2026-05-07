const LINE_CONTENT = 'https://api-data.line.me/v2/bot/message';
const ANTHROPIC_DIRECT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_BYTES = 5 * 1024 * 1024;

// Unified prompt: a screenshot is one of three things, and we let Claude
// classify in the same call as the extraction. Cheaper and lower-latency
// than a separate classify-then-extract round trip.
const EXTRACT_PROMPT = `คุณคือผู้ช่วยอ่านภาพหน้าจอแอปการลงทุน รูปอาจเป็น 1 ใน 3 แบบ:

(A) "พอร์ตการลงทุน" — แสดงรายการหุ้น/กองทุนที่ผู้ใช้ถืออยู่ตอนนี้ พร้อมจำนวน ต้นทุน ราคา มูลค่า
    ส่วนใหญ่จากแอปโบรกเกอร์ เช่น Streaming, KGI, FinansiaHero, Liberator

(B) "รายการซื้อขาย / Transaction Activity / Investment Activity" — รายการประวัติการซื้อขาย
    แต่ละรายการมี: Buy/Sell, ชื่อย่อ, จำนวนหน่วย/หุ้น, NAV หรือราคาต่อหน่วย, วันที่/เวลา
    ส่วนใหญ่จากแอป SCB Easy, Bualuang mBanking, KMA, Krungsri Plus, Settrade Streaming

(C) อย่างอื่น (ไม่ใช่ A หรือ B)

ตอบ JSON เพียงอย่างเดียว ไม่มีข้อความอื่น

ถ้าเป็น (A):
{
  "kind": "portfolio",
  "source": "<ชื่อแอป>",
  "total_value": <ตัวเลข หรือ null>,
  "cash": <ตัวเลข หรือ null>,
  "holdings": [
    {
      "symbol": "<ตัวย่อ เช่น PTT, AOT, KBANK, SCBGOLD>",
      "quantity": <จำนวน หรือ null>,
      "avg_cost": <ต้นทุนเฉลี่ย หรือ null>,
      "market_price": <ราคาตลาด หรือ null>,
      "market_value": <มูลค่าตลาด หรือ null>,
      "unrealized_pl": <กำไรขาดทุน หรือ null>,
      "weight_pct": <% หรือ null>
    }
  ],
  "warnings": [<คำเตือนถ้าตัวเลขไม่ครบ>]
}

ถ้าเป็น (B):
{
  "kind": "transactions",
  "source": "<ชื่อแอป>",
  "transactions": [
    {
      "side": "BUY" | "SELL",
      "symbol": "<ตัวย่อ เช่น SCBGOLD, KFCHINA-T10PLUS-A>",
      "quantity": <จำนวนหน่วย/หุ้น หรือ null>,
      "price": <NAV หรือราคาต่อหน่วย หรือ null>,
      "total_thb": <จำนวนเงิน THB หรือ null>,
      "executed_at": "<YYYY-MM-DD HH:MM ตาม Asia/Bangkok หรือ null>",
      "status": "done" | "processing"
    }
  ],
  "warnings": [<คำเตือน>]
}

ถ้าเป็น (C):
{ "kind": "unknown", "reason": "<สั้นๆ ภาษาไทย>" }

กฎสำคัญ (อ่านให้ครบ):
- **ต้องสำรวจทุกแถวบนหน้าจอ ห้ามข้าม** ไม่ว่าจะอยู่ในกลุ่มเดือน/ปีไหน
  ถ้าเห็น header เดือน/ปีหลายอัน (เช่น "May 2025", "April 2025", "July 2023") ให้รวมรายการของทุกเดือนเข้ามาในรายการเดียว
- เรียงตามที่ปรากฏบนหน้าจอ (ใหม่ไปเก่า) — แต่ละรายการเป็น 1 entry แยกกัน
- รายการ "Done" / "สำเร็จ" → status = "done"
- รายการ "Processing", "To Receive Units", "กำลังดำเนินการ", "รอประมวลผล" → status = "processing"
- ถ้ามีทั้ง Units และ NAV ให้ quantity = Units, price = NAV
- ถ้าเห็น "หน่วย" หรือ "Units" ให้ใช้เป็น quantity
- ถ้ามีแต่ THB amount แต่ยังไม่มี units (เช่น Processing buy ของกองทุน) ให้ quantity = null
- **ละเลย icon เล็กๆ ที่อยู่ข้างชื่อ symbol** (เช่น ⚡, ดาว, ลูกศร, badge) — symbol คือเฉพาะตัวอักษร/ตัวเลขที่เป็นชื่อย่อจริง เช่น "Sell SCBGOLD ⚡" → symbol = "SCBGOLD"
- symbol ตัวพิมพ์ใหญ่ทั้งหมด ตามที่อยู่บนหน้าจอ (เช่น KFCHINA-T10PLUS-A)
- executed_at รูปแบบ "YYYY-MM-DD HH:MM" — ถ้าเห็นเฉพาะวันที่ ให้ใส่ "00:00"
- ห้ามเดาตัวเลขที่อ่านไม่ออก ใช้ null และระบุใน warnings
- ถ้ารายการล่างถูกตัดขาดที่ขอบจอ (เห็นเดือน/ปี header แต่ไม่เห็น row ใต้นั้น) ให้เพิ่ม warning ว่า "อาจมีรายการเพิ่มเติมใต้ขอบจอ — ส่งภาพต่อได้"
- ถ้าไม่แน่ใจว่าเป็น A หรือ B (มีลักษณะของทั้งสอง) ให้เลือก B ถ้าเห็น "Buy" / "Sell" ที่ระบุวันที่ชัดเจน`;

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

// Returns a discriminated union — { kind: 'portfolio'|'transactions'|'unknown', ...fields }.
// The two kept-around aliases (`extractPortfolio`, `extractTransactions`) preserve the
// old call-site shape but route through the unified extractor.
export async function extractFromImage(env, bytes, mimeType) {
  const url = env.AI_GATEWAY_URL && env.AI_GATEWAY_URL !== 'REPLACE_WITH_YOUR_AI_GATEWAY_URL'
    ? env.AI_GATEWAY_URL.replace(/\/$/, '') + '/v1/messages'
    : ANTHROPIC_DIRECT;

  // Vision runs on Sonnet 4.6 by default — sharper than Haiku on dense
  // transaction lists (small icons, multiple Done sections, faded timestamps).
  // CLAUDE_MODEL_VISION lets you flip back to Haiku per environment.
  const body = {
    model: env.CLAUDE_MODEL_VISION || env.CLAUDE_MODEL_BALANCED || 'claude-sonnet-4-6',
    max_tokens: 4096,
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

  // Back-compat: older error shape returned {error: 'not_portfolio'}.
  // Map it to {kind: 'unknown'} so the new dispatcher in index.js doesn't have
  // to special-case it.
  if (parsed.error === 'not_portfolio') {
    return { kind: 'unknown', reason: parsed.reason || 'not_portfolio' };
  }
  if (!parsed.kind) {
    // Heuristic fallback: if it has holdings[], treat as portfolio.
    parsed.kind = Array.isArray(parsed.holdings) ? 'portfolio'
                : Array.isArray(parsed.transactions) ? 'transactions'
                : 'unknown';
  }
  return parsed;
}

// Old name kept for any callers still using it. Returns the same shape as before
// when the image is a portfolio; for non-portfolio screenshots returns the
// {error:'not_portfolio'} shape the old caller expected.
export async function extractPortfolio(env, bytes, mimeType) {
  const result = await extractFromImage(env, bytes, mimeType);
  if (result.kind === 'portfolio') return result;
  return { error: 'not_portfolio', reason: result.reason || result.kind };
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
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}
