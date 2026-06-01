// AIWealthOS Phase 4 — static topic library for the LEARN module.
//
// Hand-curated content (NOT Claude-generated) so we never hallucinate
// educational facts. Every topic has a Thai title + short definition + body
// bullet list + optional related-topic links. Bot replies to "อธิบาย <key>"
// with a Flex topic card and falls back to a Claude contextual explainer
// only when the user asks about a term we don't have in the library.

export const CATEGORIES = {
  basics:   { label: 'พื้นฐานการลงทุน', emoji: '🧱' },
  stocks:   { label: 'หุ้น',             emoji: '📈' },
  funds:    { label: 'กองทุนรวม',         emoji: '🪙' },
  risk:     { label: 'ความเสี่ยง',        emoji: '⚠️' },
  thai_tax: { label: 'ภาษีไทย',           emoji: '🇹🇭' },
  strategy: { label: 'กลยุทธ์',           emoji: '🎯' },
};

// Topic registry. Keys are lowercase identifiers used in URLs/postbacks.
// `aliases` are alternative trigger words a user might type (Thai or English,
// any case — we normalize before matching).
export const TOPICS = {
  dca: {
    key: 'dca',
    category: 'basics',
    title: 'DCA — ทยอยลงทุนแบบเฉลี่ย',
    aliases: ['dca', 'ทยอยลงทุน', 'dollar cost average', 'dollar-cost averaging', 'เฉลี่ยต้นทุน'],
    shortDef: 'แบ่งเงินลงทุนเท่าๆ กันทุกเดือน ไม่ว่าราคาจะขึ้นหรือลง — เน้นวินัย ไม่ต้องเดาก้น/ยอด',
    body: [
      'ข้อดี:',
      '• กระจายความเสี่ยงเรื่องจังหวะเข้าตลาด',
      '• สร้างวินัย ไม่ต้องเดาราคา',
      '• เหมาะกับคนที่มีรายได้ประจำ',
      'ข้อจำกัด:',
      '• ในตลาดขาขึ้นยาว ลงทุนก้อนเดียวอาจให้ผลตอบแทนสูงกว่า',
      '• ค่าคอมมิชชั่นต่อครั้งอาจกินกำไรในยอดเล็ก',
    ],
    related: ['compound', 'asset_allocation', 'long_term'],
  },
  compound: {
    key: 'compound',
    category: 'basics',
    title: 'ดอกเบี้ยทบต้น (Compound Interest)',
    aliases: ['compound', 'ดอกเบี้ยทบต้น', 'ทบต้น', 'compounding'],
    shortDef: 'ผลตอบแทนที่ได้ ถูกลงทุนต่อไป ทำให้เงินงอกเงินไปเรื่อยๆ — เวลาเป็นตัวคูณที่สำคัญที่สุด',
    body: [
      'ตัวอย่าง: เริ่ม 100,000 บาท ลงทุนที่ 7%/ปี',
      '• 10 ปี → ~197,000 บาท',
      '• 20 ปี → ~387,000 บาท',
      '• 30 ปี → ~761,000 บาท',
      'จุดสำคัญ: เริ่มเร็ว สำคัญกว่าใส่เยอะ — 5,000/เดือน 30 ปี > 10,000/เดือน 15 ปี (โดยทั่วไป)',
    ],
    related: ['dca', 'long_term'],
  },
  asset_allocation: {
    key: 'asset_allocation',
    category: 'basics',
    title: 'Asset Allocation — จัดสัดส่วนทรัพย์สิน',
    aliases: ['asset allocation', 'จัดพอร์ต', 'จัดสัดส่วน', 'allocation'],
    shortDef: 'การกระจายเงินไปในประเภทสินทรัพย์ต่างๆ (หุ้น/ETF/เงินสด) ตามเป้าและความเสี่ยงที่รับได้',
    body: [
      'หลัก:',
      '• หุ้น = ผลตอบแทนสูง แต่ผันผวน',
      '• ETF ตปท = ลดความเสี่ยงประเทศ + กระจาย sector',
      '• เงินสด = สภาพคล่อง + ลดความผันผวนรวม',
      'ตัวอย่างกรอบ 60/30/10 (สำหรับคนรับความเสี่ยงปานกลาง):',
      '• 60% หุ้นไทย · 30% ETF ตปท · 10% เงินสด',
    ],
    related: ['60_30_10', 'rebalance', 'concentration'],
  },
  rebalance: {
    key: 'rebalance',
    category: 'basics',
    title: 'Rebalance — ปรับสัดส่วนกลับเข้าแผน',
    aliases: ['rebalance', 'ปรับสัดส่วน', 'rebalancing', 'ปรับพอร์ต'],
    shortDef: 'เมื่อพอร์ตเอียงจากแผน (เช่น หุ้นโตขึ้นจน 70% ทั้งที่ตั้ง 60%) — ปรับให้กลับมาที่ 60% เดิม',
    body: [
      'วิธี (เลือกแบบใดแบบหนึ่ง):',
      '• Threshold rebalance: เมื่อใดที่ class ใดเอียง >5pp จากเป้า ค่อยปรับ',
      '• Calendar rebalance: ทุก 6 หรือ 12 เดือน ปรับครั้งหนึ่ง',
      '• DCA-rebalance: ใช้เงินเติมรายเดือนไปทาง class ที่ underweight แทนการขาย',
      'BuddyAI ใช้ DCA-rebalance เป็นหลัก — ค่าใช้จ่ายต่ำ ไม่กระทบภาษี',
    ],
    related: ['asset_allocation', 'dca', '60_30_10'],
  },
  pe: {
    key: 'pe',
    category: 'stocks',
    title: 'P/E — Price to Earnings',
    aliases: ['p/e', 'pe', 'price to earnings', 'พีอี'],
    shortDef: 'ราคาหุ้น ÷ กำไรต่อหุ้น (EPS) — บอกว่าซื้อ "กำไร 1 บาท" ในราคากี่บาท',
    body: [
      'การอ่าน (ทั่วๆ ไป):',
      '• P/E ต่ำ (< 10) อาจถูก หรือมีปัญหาที่ตลาดเห็น',
      '• P/E กลาง (10-20) ทั่วไปของหุ้นพื้นฐานดี',
      '• P/E สูง (> 25) ตลาดคาดการเติบโตสูง',
      'ข้อระวัง:',
      '• P/E อย่างเดียวไม่พอ — ต้องดู growth, debt, ROE ประกอบ',
      '• กลุ่ม sector ต่างกัน P/E ปกติต่างกัน',
    ],
    related: ['eps', 'roe', 'yield_trap'],
  },
  eps: {
    key: 'eps',
    category: 'stocks',
    title: 'EPS — Earnings per Share',
    aliases: ['eps', 'earnings per share', 'กำไรต่อหุ้น'],
    shortDef: 'กำไรสุทธิ ÷ จำนวนหุ้น — บอกว่าหุ้น 1 หุ้นทำกำไรได้กี่บาท',
    body: [
      'จุดสำคัญ:',
      '• EPS โตขึ้นต่อเนื่อง = บริษัทแข็งแรงขึ้น',
      '• EPS ลดลง 2-3 ปีติดต่อกัน = ระวัง',
      '• เทียบ EPS forecast vs actual — บริษัทดีมักทำได้ตามหรือเกิน',
    ],
    related: ['pe', 'roe'],
  },
  roe: {
    key: 'roe',
    category: 'stocks',
    title: 'ROE — Return on Equity',
    aliases: ['roe', 'return on equity', 'ผลตอบแทนต่อส่วนผู้ถือหุ้น'],
    shortDef: 'กำไรสุทธิ ÷ ส่วนผู้ถือหุ้น — บอกว่าบริษัทใช้เงินทุนทำกำไรได้เก่งแค่ไหน',
    body: [
      '• ROE > 15% ถือว่าดี',
      '• ROE > 20% ต่อเนื่อง = แข็งแกร่งมาก (เช่น เซเว่นอีเลฟเว่น CPALL ในยุคทอง)',
      '• ROE ต่ำ (< 10%) อาจสะท้อนธุรกิจที่ใช้เงินทุนเยอะแต่ผลตอบแทนน้อย',
      'ระวัง: ROE สูงจากหนี้สูงไม่ใช่สัญญาณดี — ดู debt/equity ประกอบ',
    ],
    related: ['eps', 'pe'],
  },
  dividend: {
    key: 'dividend',
    category: 'stocks',
    title: 'ปันผล (Dividend)',
    aliases: ['dividend', 'ปันผล', 'div'],
    shortDef: 'เงินที่บริษัทจ่ายให้ผู้ถือหุ้นจากกำไร — มักจ่ายปีละ 1-2 ครั้ง',
    body: [
      'ผลตอบแทนรวมจากหุ้น = ราคาขึ้น + ปันผล',
      'หุ้นไทยที่จ่ายปันผลสม่ำเสมอ มัก dividend yield 3-6%',
      'จุดสำคัญ:',
      '• Payout ratio (ปันผลออก / กำไรสุทธิ) ที่ยั่งยืน < 80%',
      '• ดู dividend growth — จ่ายเพิ่มขึ้นทุกปีดีกว่าจ่ายเท่าเดิม',
    ],
    related: ['dividend_yield', 'yield_trap', 'withholding_tax'],
  },
  dividend_yield: {
    key: 'dividend_yield',
    category: 'stocks',
    title: 'Dividend Yield — อัตราผลตอบแทนปันผล',
    aliases: ['dividend yield', 'div yield', 'ผลตอบแทนปันผล', 'yield'],
    shortDef: 'ปันผลต่อปี ÷ ราคาหุ้น × 100 — บอกว่าผลตอบแทนปันผลเทียบราคาตอนนี้กี่ %',
    body: [
      'ตัวอย่าง: หุ้นราคา 100 บาท จ่ายปันผล 5 บาท/ปี → yield = 5%',
      'การอ่าน:',
      '• 3-5% = เหมาะกับการสร้าง passive income',
      '• > 8% = อาจเป็น yield trap ตรวจสอบ payout ratio + business',
      '• Yield on cost = ปันผล ÷ ราคาที่ซื้อ — สำคัญสำหรับนักลงทุนระยะยาว',
    ],
    related: ['dividend', 'yield_trap'],
  },
  yield_trap: {
    key: 'yield_trap',
    category: 'risk',
    title: 'Yield Trap — กับดักปันผลสูง',
    aliases: ['yield trap', 'กับดักปันผล', 'ดักจับ yield'],
    shortDef: 'หุ้นที่ yield สูงผิดปกติ มักเป็นเพราะราคาลด ไม่ใช่ปันผลโต — สัญญาณว่าธุรกิจมีปัญหา',
    body: [
      'สัญญาณ yield trap:',
      '• Yield > 8-10% ในขณะที่กลุ่ม sector ปกติ 3-5%',
      '• ราคาหุ้นลดต่อเนื่อง > 12 เดือน',
      '• Payout ratio > 100% (จ่ายปันผลเกินกำไร)',
      '• EPS / รายได้ ลดลงต่อเนื่อง',
      'วิธีตรวจ: ดูประวัติปันผล 5 ปีย้อนหลัง — ถ้า "yield สูง" เพราะราคาลด ไม่ใช่เพราะปันผลโต = ระวัง',
    ],
    related: ['dividend_yield', 'dividend'],
  },
  nav: {
    key: 'nav',
    category: 'funds',
    title: 'NAV — Net Asset Value',
    aliases: ['nav', 'net asset value', 'มูลค่าหน่วยลงทุน'],
    shortDef: 'ราคาหน่วยลงทุนของกองทุนรวม — คำนวณจากมูลค่าสินทรัพย์สุทธิ ÷ จำนวนหน่วยลงทุน',
    body: [
      'จุดสำคัญ:',
      '• NAV update รายวัน (มักหลังตลาดปิด)',
      '• ซื้อ-ขายกองทุนใช้ NAV ของวันทำการที่ส่งคำสั่ง',
      '• NAV ไม่เกี่ยวกับ "ราคาถูก/แพง" — เปรียบเทียบ NAV ของคนละกองไม่มีประโยชน์',
      'สิ่งที่ดู: ผลตอบแทน 1/3/5 ปี + ค่าธรรมเนียม TER',
    ],
    related: ['etf', 'rmf', 'ssf'],
  },
  etf: {
    key: 'etf',
    category: 'funds',
    title: 'ETF — Exchange-Traded Fund',
    aliases: ['etf', 'exchange traded fund', 'อีทีเอฟ'],
    shortDef: 'กองทุนรวมที่ซื้อ-ขายในตลาดเหมือนหุ้น — มักเป็น "passive" ที่อิงดัชนี (SET50, S&P 500)',
    body: [
      'ข้อดี:',
      '• ค่าธรรมเนียมต่ำกว่ากองทุน active (0.1-0.5% vs 1-2%)',
      '• ซื้อ-ขายในเวลาตลาด ไม่ต้องรอ NAV ปลายวัน',
      '• กระจายเสี่ยงทันทีจาก 1 ตัว',
      'ETF ยอดนิยมสำหรับ Thai investor:',
      '• VOO / VTI = S&P 500 / Total US market',
      '• VWRA / VWRD = ทั้งโลก',
      '• SET50 / SETHD = ดัชนีไทย',
    ],
    related: ['nav', 'asset_allocation'],
  },
  rmf: {
    key: 'rmf',
    category: 'funds',
    title: 'RMF — Retirement Mutual Fund',
    aliases: ['rmf', 'retirement mutual fund', 'กองทุนเพื่อการเลี้ยงชีพ'],
    shortDef: 'กองทุนลดหย่อนภาษี (สูงสุด 30% ของรายได้ ไม่เกิน 500K) — ถือยาวจนอายุ 55 + ซื้อ 5+ ปี',
    body: [
      'เงื่อนไข:',
      '• ซื้อต่อเนื่องอย่างน้อยปีเว้นปี (จริงๆ คือพยายามซื้อทุกปี)',
      '• ขายได้เมื่ออายุครบ 55 + ถือมาแล้ว 5 ปีขึ้นไป',
      '• ถ้าผิดเงื่อนไข → คืนภาษีที่ลดไปทั้งหมด',
      'ดีสำหรับ:',
      '• คนที่อยู่ในฐานภาษี 20%+',
      '• เริ่มต้นออม เพื่อเกษียณก่อน 55',
    ],
    related: ['ssf', 'withholding_tax'],
  },
  ssf: {
    key: 'ssf',
    category: 'funds',
    title: 'SSF — Super Savings Fund',
    aliases: ['ssf', 'super savings fund', 'กองทุนรวมเพื่อการออม'],
    shortDef: 'กองทุนลดหย่อนภาษี (สูงสุด 30% ของรายได้ ไม่เกิน 200K) — ต้องถือ 10 ปีขึ้นไป',
    body: [
      'ต่างจาก RMF:',
      '• ไม่ต้องรอถึงอายุ 55',
      '• ถือครบ 10 ปี ขายได้',
      '• เพดานลดภาษี 200K vs RMF 500K',
      'มี SSF หลากหลายแบบ: หุ้นไทย ETF ตปท ตราสารหนี้',
    ],
    related: ['rmf', 'asset_allocation'],
  },
  withholding_tax: {
    key: 'withholding_tax',
    category: 'thai_tax',
    title: 'ภาษีหัก ณ ที่จ่าย ปันผล',
    aliases: ['withholding tax', 'หัก ณ ที่จ่าย', 'ภาษีปันผล'],
    shortDef: 'หุ้นไทยจ่ายปันผล จะถูกหักภาษี 10% อัตโนมัติ — สามารถขอเครดิตคืนหรือเลือกไม่นำมารวมรายได้',
    body: [
      'สำหรับหุ้นไทย:',
      '• ปันผลถูกหัก 10% ก่อนถึงมือ',
      '• "ใช้สิทธิเครดิตภาษีปันผล" หากฐานภาษีต่ำ → ได้คืน',
      '• ไม่ใช้สิทธิ → ปันผลไม่ต้องนำมารวมรายได้ (final)',
      'สำหรับ ETF/หุ้นต่างประเทศ:',
      '• ปันผลถูกหักโดยประเทศต้นทาง (15-30%)',
      '• ขอคืนได้ตามสนธิสัญญาภาษีซ้อน (DTA)',
    ],
    related: ['dividend', 'capital_gains'],
  },
  capital_gains: {
    key: 'capital_gains',
    category: 'thai_tax',
    title: 'กำไรจากการขายหุ้นไทย',
    aliases: ['capital gains', 'capital gain', 'กำไรขายหุ้น'],
    shortDef: 'หุ้นไทยขายในตลาด SET — ยังไม่มีภาษีกำไร (ปัจจุบัน) สำหรับนักลงทุนทั่วไป',
    body: [
      'หุ้นไทย: ไม่เก็บภาษี capital gain (ปัจจุบัน) สำหรับคนธรรมดา',
      'หุ้น/ETF ต่างประเทศ:',
      '• ถือ + ขายในต่างประเทศ ไม่นำเงินกลับ = ไม่เสียภาษีไทย',
      '• นำเงินกลับไทยปีเดียวกับขาย = เสียภาษีไทย (ฐานรายได้)',
      'หมายเหตุ: กฎภาษีเปลี่ยนได้ — ติดตามข่าวภาษีปีนั้นๆ',
    ],
    related: ['withholding_tax'],
  },
  concentration: {
    key: 'concentration',
    category: 'risk',
    title: 'Concentration Risk — ความเสี่ยงกระจุกตัว',
    aliases: ['concentration', 'concentration risk', 'กระจุกตัว', 'ความเสี่ยงกระจุก'],
    shortDef: 'พอร์ตที่ทุนอยู่กับหุ้นหรือ sector เพียงไม่กี่ตัว — เสี่ยงสูงเมื่อตัวนั้นมีปัญหา',
    body: [
      'สัญญาณกระจุกตัว:',
      '• หุ้นตัวเดียว > 25% ของพอร์ต',
      '• Sector เดียว > 40-50%',
      '• ประเทศเดียว 100% (ทุกอย่างอยู่ไทย หรือทุกอย่างอยู่ US)',
      'วิธีแก้: ทยอย DCA ไปทาง class/sector ที่ underweight แทนการขายของเดิม',
    ],
    related: ['asset_allocation', 'currency_risk'],
  },
  currency_risk: {
    key: 'currency_risk',
    category: 'risk',
    title: 'Currency Risk — ความเสี่ยงค่าเงิน',
    aliases: ['currency risk', 'fx risk', 'ความเสี่ยงค่าเงิน', 'ค่าเงิน'],
    shortDef: 'ถือสินทรัพย์ต่างประเทศ = รับ exposure ของค่าเงินไปด้วย — บาทแข็ง = มูลค่า USD ลดลงในรูป THB',
    body: [
      'ตัวอย่าง: VOO ราคาขึ้น 10% ใน USD',
      '• ถ้าบาทอ่อน 5% ในช่วงเดียวกัน → ผลตอบแทน THB ~15%',
      '• ถ้าบาทแข็ง 5% → ผลตอบแทน THB ~5%',
      'กลยุทธ์:',
      '• ETF "H" (hedged) ปิดความเสี่ยง FX แต่มีค่าธรรมเนียมเพิ่ม',
      '• ETF "UH" (unhedged) เปิดรับ FX exposure',
      '• สำหรับนักลงทุนระยะยาว มักไม่ hedge เพราะ FX กระจายเสี่ยงโดยธรรมชาติ',
    ],
    related: ['etf', 'concentration'],
  },
  volatility: {
    key: 'volatility',
    category: 'risk',
    title: 'Volatility — ความผันผวน',
    aliases: ['volatility', 'ความผันผวน', 'vix', 'σ'],
    shortDef: 'ระดับความเคลื่อนไหวของราคาหุ้น/ตลาด — ผันผวนสูง = ราคาเหวี่ยงมาก ไม่ใช่ขาดทุนเสมอ',
    body: [
      'ตัวชี้:',
      '• VIX ของ S&P 500: < 15 สงบ, > 30 ตื่นตกใจ',
      '• Beta ของหุ้น: 1 = ตามตลาด, > 1 ผันผวนกว่าตลาด',
      'จุดสำคัญ:',
      '• Volatility ≠ Risk: ผันผวนสูงไม่ใช่จะขาดทุน',
      '• นักลงทุนระยะยาวควรชินกับ -10% / -20% drawdown',
      '• DCA ลดผลกระทบของ volatility ได้ดี',
    ],
    related: ['dca', 'long_term'],
  },
  '60_30_10': {
    key: '60_30_10',
    category: 'strategy',
    title: '60/30/10 Framework',
    aliases: ['60/30/10', '60-30-10', '60 30 10', 'sixty thirty ten'],
    shortDef: 'กรอบการจัดพอร์ตของผู้สร้าง BuddyAI — 60% หุ้นไทย / 30% ETF ตปท / 10% เงินสด',
    body: [
      'หลักการ:',
      '• 60% หุ้นไทย — เลือกหุ้นปันผลที่ ROE > 12% สม่ำเสมอ',
      '• 30% ETF ตปท — VOO หรือ VWRA เป็นแกน',
      '• 10% เงินสด — สำหรับโอกาส (ตลาดร่วง > 15%) และฉุกเฉิน',
      'ทำไมไม่ใช่ 100% หุ้น:',
      '• เงินสดเป็น "ammunition" ในตลาดขาลง',
      '• ช่วยลด volatility ของพอร์ตรวม',
      'ปรับได้ตามความเสี่ยงที่รับได้',
    ],
    related: ['asset_allocation', 'rebalance'],
  },
  long_term: {
    key: 'long_term',
    category: 'strategy',
    title: 'Long-term Investing — ลงทุนระยะยาว',
    aliases: ['long term', 'long-term', 'ระยะยาว', 'ถือยาว', 'buy and hold'],
    shortDef: 'ถือหุ้น/ETF คุณภาพดี 5-10+ ปี ปล่อยให้ compounding ทำงาน — ตรงข้ามกับเทรดสั้น',
    body: [
      'หลักฐานทางสถิติ:',
      '• S&P 500 ตั้งแต่ 1928: ผลตอบแทน ~10%/ปี (เฉลี่ย)',
      '• ผู้ถือ 10+ ปี: บวกแทบ 100% ของกรณี',
      '• Time in market > Timing the market',
      'จุดสำคัญ:',
      '• เลือกบริษัท/กองทุนที่ปัจจัยพื้นฐานแข็งแกร่ง',
      '• อดทนผ่าน drawdown -20% / -30% ของตลาด',
      '• อย่าขายเพราะข่าวร้ายระยะสั้น',
    ],
    related: ['compound', 'dca', 'volatility'],
  },
};

// Lookup by key OR by alias (case-insensitive, trimmed, Thai-tolerant).
export function findTopic(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  if (!q) return null;
  // Direct key match
  if (TOPICS[q]) return TOPICS[q];
  // Alias match
  for (const t of Object.values(TOPICS)) {
    if ((t.aliases || []).some((a) => String(a).toLowerCase() === q)) return t;
  }
  // Loose contains match — last resort, useful for partial Thai queries
  for (const t of Object.values(TOPICS)) {
    if (t.title.toLowerCase().includes(q)) return t;
    if ((t.aliases || []).some((a) => String(a).toLowerCase().includes(q))) return t;
  }
  return null;
}

// Grouped list for the topic-list card.
export function listTopicsByCategory() {
  const grouped = {};
  for (const t of Object.values(TOPICS)) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push({ key: t.key, title: t.title });
  }
  return Object.entries(CATEGORIES).map(([catKey, cat]) => ({
    category: catKey,
    label: cat.label,
    emoji: cat.emoji,
    topics: grouped[catKey] || [],
  }));
}
