// Asset-class taxonomy for the wealth view. Each class has display metadata
// (Thai label, emoji, color) and a default currency used when summing into a
// THB net worth.
//
// The taxonomy is intentionally coarse — it's the granularity a Thai
// long-term investor actually thinks at (Thai stocks vs global ETFs vs Thai
// funds vs cash), not the granularity of a portfolio analytics tool.

export const ASSET_CLASSES = {
  thai_equity: { label: 'หุ้นไทย',      emoji: '🇹🇭', color: '#0EA5E9', currency: 'THB' },
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

  // Global ETF / US stock — 1-5 letter all-caps tickers (VOO, VWRA, AAPL,
  // MSFT, SPY, QQQ). Conservative because Thai SET symbols are also short
  // letters (PTT, AOT). Fall through to thai_equity by default; only flag
  // as global if it matches a well-known global ticker.
  const KNOWN_GLOBAL = new Set([
    'VOO', 'VTI', 'VWRA', 'VWRD', 'VEA', 'VEU', 'SPY', 'QQQ', 'IVV', 'AGG',
    'BND', 'EWY', 'EWJ', 'INDA', 'EEM', 'IEMG', 'GLD', 'IAU', 'TLT', 'HYG',
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK.B',
  ]);
  if (KNOWN_GLOBAL.has(s)) return 'global_etf';

  // Default: Thai equity (matches our user base)
  return 'thai_equity';
}

// Currency the holding is denominated in — usually a property of its class,
// not the symbol itself. Caller can override via the explicit `currency`
// column on portfolios (the reporting currency from the broker's screen).
export function defaultCurrencyForClass(assetClass) {
  return ASSET_CLASSES[assetClass]?.currency || 'THB';
}
