// AIWealthOS Phase 4 — LEARN module Flex cards.

import { CATEGORIES, TOPICS } from '../education/topics.js';

// Single-topic explainer card. Static content from the curated topic
// library — no Claude call needed for these.
export function topicCard(topic) {
  const cat = CATEGORIES[topic.category] || { label: '', emoji: '📚' };
  const relatedRefs = (topic.related || [])
    .map((k) => TOPICS[k])
    .filter(Boolean)
    .slice(0, 4);

  const body = [];

  // Short definition in a tinted block — first thing the user reads.
  body.push({
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#0EA5E912',
    cornerRadius: '10px',
    paddingAll: '14px',
    spacing: 'xs',
    contents: [
      { type: 'text', text: 'นิยามสั้น', size: 'xxs', color: '#0369A1', weight: 'bold' },
      { type: 'text', text: topic.shortDef, wrap: true, size: 'sm', color: '#0F172A' },
    ],
  });

  // Body bullet list.
  if (Array.isArray(topic.body) && topic.body.length) {
    body.push({ type: 'separator', margin: 'md' });
    for (const line of topic.body) {
      body.push({
        type: 'text',
        text: String(line),
        wrap: true,
        size: 'xs',
        color: '#1E293B',
      });
    }
  }

  // Related topics → tappable buttons via message events that route through
  // the existing "อธิบาย <key>" parser.
  if (relatedRefs.length) {
    body.push({ type: 'separator', margin: 'md' });
    body.push({
      type: 'text',
      text: 'อ่านต่อ',
      weight: 'bold',
      size: 'sm',
      color: '#0F172A',
      margin: 'md',
    });
    for (const r of relatedRefs) {
      body.push({
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'message',
          label: `📖 ${r.title.length > 26 ? r.title.slice(0, 26) + '…' : r.title}`,
          text: `อธิบาย ${r.key}`,
        },
      });
    }
  }

  return {
    type: 'flex',
    altText: topic.title,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand(`${cat.emoji} ${topic.title}`, cat.label),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เนื้อหาเพื่อการศึกษา · ไม่ใช่คำแนะนำการลงทุนเฉพาะบุคคล',
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

// Topic list — grouped by category. Each row tappable, sends "อธิบาย <key>".
export function topicListCard(groups) {
  const body = [];

  for (const g of groups) {
    if (!g.topics.length) continue;
    body.push({
      type: 'text',
      text: `${g.emoji}  ${g.label}`,
      weight: 'bold',
      size: 'sm',
      color: '#0F172A',
      margin: 'md',
    });
    for (const t of g.topics) {
      body.push({
        type: 'box',
        layout: 'horizontal',
        paddingAll: '8px',
        cornerRadius: '6px',
        backgroundColor: '#F8FAFC',
        margin: 'xs',
        action: {
          type: 'message',
          label: t.title,
          text: `อธิบาย ${t.key}`,
        },
        contents: [
          { type: 'text', text: t.title, size: 'sm', color: '#1E293B', wrap: true, flex: 5 },
          { type: 'text', text: '›', size: 'md', color: '#94A3B8', align: 'end', flex: 0 },
        ],
      });
    }
  }

  return {
    type: 'flex',
    altText: 'หัวข้ออธิบายทั้งหมด',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand('📚 อธิบายเรื่องการเงิน', 'ห้องสมุดความรู้นักลงทุนไทย'),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์ "อธิบาย <คำที่อยากรู้>" — ถ้าไม่อยู่ในรายการ บอท จะตอบโดยใช้ AI',
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

// Card for the Claude-contextual fallback when the user asks about something
// not in our curated library.
export function aiExplainerCard({ query, answer }) {
  return {
    type: 'flex',
    altText: `อธิบาย: ${query}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: heroBand(`🤖 อธิบาย "${query.slice(0, 24)}"`, 'ตอบโดย AI · อิงพอร์ตของคุณบางส่วน'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: answer,
            wrap: true,
            size: 'sm',
            color: '#1E293B',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'ดูหัวข้ออธิบายอื่นๆ',
              text: 'อธิบาย',
            },
          },
          {
            type: 'text',
            text: 'คำตอบเป็นการศึกษาเท่านั้น · AI อาจตอบไม่ครบ — ตรวจสอบเพิ่มจากแหล่งอื่น',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
            wrap: true,
            margin: 'sm',
          },
        ],
      },
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
