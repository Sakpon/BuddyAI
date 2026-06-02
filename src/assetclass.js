// Asset-class taxonomy for the wealth view. Each class has display metadata
// (Thai label, emoji, color) and a default currency used when summing into a
// THB net worth.
//
// The taxonomy is intentionally coarse — it's the granularity a Thai
// long-term investor actually thinks at (Thai stocks vs global ETFs vs Thai
// funds vs cash), not the granularity of a portfolio analytics tool.

export const ASSET_CLASSES = {
  thai_equity: { label: 'หุ้นไทย',      emoji: '🇹🇭', color: '#0EA5E9', currency: 'THB' },
  us_equity:   { label: 'หุ้นสหรัฐ',     emoji: '🇺🇸', color: '#2563EB', currency: 'USD' },
  global_etf:  { label: 'ETF/หุ้นต่างประเทศ', emoji: '🌎', color: '#16A34A', currency: 'USD' },
  hk_equity:   { label: 'หุ้นฮ่องกง',    emoji: '🇭🇰', color: '#DC2626', currency: 'HKD' },
  thai_fund:   { label: 'กองทุนรวม',     emoji: '🪙', color: '#D97706', currency: 'THB' },
  cash:        { label: 'เงินสด/เงินฝาก', emoji: '💵', color: '#475569', currency: 'THB' },
  crypto:      { label: 'คริปโต',        emoji: '₿',  color: '#F59E0B', currency: 'USD' },
  other:       { label: 'อื่นๆ',         emoji: '📦', color: '#94A3B8', currency: 'THB' },
};

const VALID_CLASSES = new Set(Object.keys(ASSET_CLASSES));

export function isValidClass(c) {
  return typeof c === 'string' && VALID_CLASSES.has(c);
}

// Heuristic symbol → class classifier. Conservative: when in doubt, default
// to thai_equity (the dominant case for our user base). Users can override
// later via a manual tag command.
export function inferAssetClass(symbol) {
  const s = String(symbol || '').toUpperCase().trim();
  if (!s) return 'other';

  // Hong Kong: numeric tickers (0700, 9988) or .HK suffix
  if (/^\d{1,5}$/.test(s) || /\.HK$/.test(s)) return 'hk_equity';

  // Explicit market suffixes — most common ways a fund-of-funds gets imported
  if (/\.BK$/.test(s) || /\.TH$/.test(s)) return 'thai_equity';

  // Crypto — handful of common tickers
  if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE'].includes(s)) return 'crypto';
  if (/-USD$|-USDT$/.test(s)) return 'crypto';

  // Thai mutual funds — usually have a fund-house prefix + theme name and
  // a hyphen-separated suffix. Examples from the wild:
  //   KFCHINA-T10PLUS-A, SCBGOLD, K-USA, B-INNOTECH, BCAP-USEQ, ASP-AGRI
  if (
    /^(KF|SCB|K-|B-|BCAP|ASP|TMB|TISCO|UOB|BBL|MFC|KSAM|BCAP|ONEAM|EASTSPRING|VS|LH|PHATRA|PRINCIPAL)/.test(s)
    || /-(A|R|RMF|SSF|D|H|UH)$/.test(s)
    || /(GOLD|CHINA|JAPAN|EUROPE|INDIA|ASIA|VIETNAM|GLOBAL|USEQ|EM)/.test(s)
  ) {
    return 'thai_fund';
  }

  // US individual stocks — split from global_etf so the goal card's
  // proportion section shows "หุ้นสหรัฐ" as its own row instead of
  // bucketing it under "ETF/หุ้นต่างประเทศ". Conservative: only well-known
  // tickers, since 1-5 letter all-caps overlaps with Thai SET symbols.
  if (KNOWN_US_STOCKS.has(s)) return 'us_equity';

  // Global / US ETFs and other index/bond funds (broker confirmations of
  // ETF purchases also fall here when the symbol is listed on a US exchange).
  if (KNOWN_GLOBAL_ETF.has(s)) return 'global_etf';

  // Default: Thai equity (matches our user base)
  return 'thai_equity';
}

export const KNOWN_US_STOCKS = new Set([
  // Mega-cap US individual stocks. Keep the list tight — when in doubt,
  // fall through to thai_equity (the more common case for our Thai users).
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA',
  'BRK.B', 'BRK-B', 'BRK.A', 'BRK-A',
  'JPM', 'V', 'MA', 'JNJ', 'WMT', 'XOM', 'PG', 'HD', 'CVX', 'KO', 'PEP',
  'NFLX', 'AMD', 'INTC', 'CRM', 'ADBE', 'ORCL', 'CSCO', 'AVGO', 'PYPL',
  'DIS', 'NKE', 'COST', 'ABBV', 'PFE', 'MRK', 'LLY', 'UNH',
  'BAC', 'WFC', 'GS', 'MS',
  'BA', 'CAT', 'GE', 'F', 'GM',
  'T', 'VZ', 'TMUS',
  'UBER', 'LYFT', 'SHOP', 'SQ', 'COIN', 'PLTR', 'SNOW', 'NOW', 'ZM',
]);

const KNOWN_GLOBAL_ETF = new Set([
  // Broad-market / theme ETFs (mostly US-listed) and a few bond/EM proxies.
  'VOO', 'VTI', 'VT', 'VWRA', 'VWRD', 'VEA', 'VEU', 'VYM',
  'SPY', 'QQQ', 'IVV', 'SCHD', 'DIA', 'IWM',
  'AGG', 'BND', 'TLT', 'HYG', 'LQD', 'BNDW',
  'EWY', 'EWJ', 'INDA', 'EEM', 'IEMG', 'VWO', 'EFA', 'IEFA',
  'GLD', 'IAU', 'SLV',
  'ARKK', 'XLF', 'XLK', 'XLE', 'XLV', 'XLY', 'XLI',
]);

// Currency the holding is denominated in — usually a property of its class,
// not the symbol itself. Caller can override via the explicit `currency`
// column on portfolios (the reporting currency from the broker's screen).
export function defaultCurrencyForClass(assetClass) {
  return ASSET_CLASSES[assetClass]?.currency || 'THB';
}
