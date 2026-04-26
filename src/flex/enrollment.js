export function enrollmentCard() {
  return {
    type: 'flex',
    altText: 'สมัครรับการแจ้งเตือนหุ้นรายวัน',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: 'FinBot Daily', color: '#F8FAFC', weight: 'bold', size: 'sm' },
          { type: 'text', text: 'แจ้งเตือนหุ้นเด่นทุกเช้า 09:00', color: '#94A3B8', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'รับสรุปหุ้นน่าจับตา + แนวคิดการลงทุน ทุกวันทำการ', wrap: true, size: 'sm', color: '#1E293B' },
          { type: 'separator' },
          { type: 'text', text: '• คัดกรองโดย Claude Haiku 4.5\n• ส่งเฉพาะวันทำการ\n• ยกเลิกได้ทุกเมื่อ', wrap: true, size: 'xs', color: '#475569' },
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
            action: { type: 'message', label: 'สมัครการแจ้งเตือน', text: 'สมัครการแจ้งเตือน' },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'message', label: 'ยกเลิกการแจ้งเตือน', text: 'ยกเลิกการแจ้งเตือน' },
          },
        ],
      },
    },
  };
}
