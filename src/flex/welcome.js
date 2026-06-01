// AIWealthOS-themed welcome card shown on /follow.
//
// Three-step orientation — matches the deck's SEE / PLAN / ACT structure.
// Replaces the older enrollment card which framed the bot as a stock-alert
// service, not a wealth-OS.

export function welcomeWealthOSCard({ displayName }) {
  const greeting = displayName
    ? `สวัสดี ${displayName.slice(0, 24)} 👋`
    : 'ยินดีต้อนรับ 👋';

  return {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ BuddyAI — ทำความรู้จักกับ Wealth OS',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand(greeting),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: 'BuddyAI ช่วยคุณสร้างความมั่งคั่งระยะยาว — ไม่ใช่แอปเทรด แต่เป็นเครื่องมือสำหรับนักลงทุนที่จริงจัง',
            wrap: true,
            size: 'sm',
            color: '#1E293B',
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'เริ่มใน 3 ขั้นตอน',
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            margin: 'md',
          },
          stepCard('1', '📷', 'ส่งภาพพอร์ตจากแอปโบรกเกอร์',
            'BuddyAI จะอ่านและสรุปทรัพย์สินทั้งหมดของคุณเป็นเงินบาทในมุมมองเดียว — รวมหุ้นไทย ETF ต่างประเทศ กองทุน เงินสด', '#0EA5E9'),
          stepCard('2', '🎯', 'ตั้งเป้าหมายความมั่งคั่ง',
            'พิมพ์ "ตั้งเป้าหมาย" — BuddyAI จะคำนวณว่าคุณต้อง DCA เดือนละเท่าไหร่เพื่อไปถึงเป้า', '#16A34A'),
          stepCard('3', '💰', 'เติม DCA แต่ละเดือน',
            'พิมพ์ "เติม <จำนวน>" — BuddyAI ติดตามวินัยการลงทุนของคุณ พร้อม nudge เมื่อพอร์ตเอียงจากเป้า', '#D97706'),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#0EA5E9',
                height: 'sm',
                flex: 3,
                action: {
                  type: 'message',
                  label: 'พิมพ์ /help',
                  text: '/help',
                },
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                flex: 2,
                action: {
                  type: 'postback',
                  label: 'ดูตัวอย่าง',
                  data: 'action=welcome-demo',
                  displayText: 'ดูตัวอย่างการใช้งาน',
                },
              },
            ],
          },
          {
            type: 'text',
            text: 'เพื่อการศึกษาเท่านั้น · ไม่ใช่คำแนะนำการลงทุนส่วนบุคคล',
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

// Small reference card explaining the typical user journey — surfaced
// when the user taps "ดูตัวอย่าง" on the welcome card.
export function welcomeDemoCard() {
  return {
    type: 'flex',
    altText: 'ตัวอย่างการใช้งาน BuddyAI',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('ตัวอย่างคำสั่ง'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          demoBlock('🏛 ดูทรัพย์สิน', [
            '"ความมั่งคั่ง" → สรุปทุกพอร์ตเป็นเงินบาท',
            '"พอร์ตทั้งหมด" → รายชื่อพอร์ตทั้งหมด',
            '"ประวัติพอร์ต" → ไทม์ไลน์ความมั่งคั่ง',
          ]),
          demoBlock('🎯 วางแผน', [
            '"ตั้งเป้าหมาย" → ตั้งเป้าระยะยาว + DCA',
            '"เป้าหมาย" → ดูความก้าวหน้า',
            '"เติม 30000" → บันทึก DCA เดือนนี้',
          ]),
          demoBlock('🤖 AI ช่วยคิด', [
            '"วิเคราะห์พอร์ต" → ความเห็นจาก AI',
            '"ปรับพอร์ต" → คำแนะนำการปรับพอร์ต',
            '"สถานะหุ้น" → ราคาล่าสุด + คำแนะนำรายตัว',
          ]),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์ /help เพื่อดูคำสั่งทั้งหมด',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
          },
        ],
      },
    },
  };
}

// Small "next-step" nudge shown after the user saves their first portfolio.
// Suggests setting up a goal so the wealth-OS loop closes.
export function postSaveGoalNudgeCard({ portfolioName, holdingCount }) {
  return {
    type: 'flex',
    altText: 'ก้าวต่อไป: ตั้งเป้าหมายและคำนวณ DCA',
    contents: {
      type: 'bubble',
      size: 'kilo',
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
            paddingAll: '12px',
            spacing: 'xs',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '✓', size: 'lg', color: '#16A34A', flex: 0 },
                  { type: 'text', text: `บันทึก "${portfolioName}" แล้ว`, weight: 'bold', size: 'md', color: '#16A34A', flex: 5, wrap: true },
                ],
              },
              { type: 'text', text: `รวม ${holdingCount} ตัว · ตั้งเป็นพอร์ตที่ใช้งาน`, size: 'xs', color: '#475569' },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'ขั้นต่อไป — ตั้งเป้าหมาย',
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            margin: 'md',
          },
          {
            type: 'text',
            text: 'ให้ BuddyAI คำนวณว่าคุณต้อง DCA เดือนละเท่าไหร่ — พร้อมสถานะอยู่ในแผน / ตามไม่ทัน ให้ติดตามทุกเดือน',
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
          {
            type: 'button',
            style: 'primary',
            color: '#16A34A',
            height: 'sm',
            action: {
              type: 'message',
              label: '🎯 ตั้งเป้าหมายตอนนี้',
              text: 'ตั้งเป้าหมาย',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ภายหลัง — ดูพอร์ตก่อน',
              text: 'พอร์ต',
            },
          },
        ],
      },
    },
  };
}

function heroBand(title) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0F172A',
    paddingAll: '20px',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '💼', size: 'xl', flex: 0 },
          { type: 'text', text: title, color: '#F8FAFC', weight: 'bold', size: 'lg', flex: 5, gravity: 'center' },
        ],
      },
      {
        type: 'text',
        text: 'AI Wealth OS · เครื่องมือสร้างความมั่งคั่งระยะยาว',
        color: '#94A3B8',
        size: 'xs',
        margin: 'sm',
        wrap: true,
      },
    ],
  };
}

function stepCard(number, emoji, title, description, accentColor) {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    margin: 'sm',
    paddingAll: '10px',
    cornerRadius: '8px',
    backgroundColor: '#F8FAFC',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        flex: 0,
        backgroundColor: accentColor,
        cornerRadius: '16px',
        width: '32px',
        height: '32px',
        contents: [{
          type: 'text',
          text: number,
          color: '#FFFFFF',
          weight: 'bold',
          size: 'md',
          align: 'center',
          gravity: 'center',
        }],
      },
      {
        type: 'box',
        layout: 'vertical',
        flex: 5,
        spacing: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              { type: 'text', text: emoji, size: 'sm', flex: 0 },
              { type: 'text', text: title, size: 'sm', weight: 'bold', color: '#0F172A', flex: 5 },
            ],
          },
          { type: 'text', text: description, size: 'xxs', color: '#475569', wrap: true },
        ],
      },
    ],
  };
}

function demoBlock(title, examples) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: [
      { type: 'text', text: title, weight: 'bold', size: 'sm', color: '#0F172A' },
      ...examples.map((line) => ({
        type: 'text',
        text: '• ' + line,
        wrap: true,
        size: 'xs',
        color: '#475569',
      })),
    ],
  };
}
