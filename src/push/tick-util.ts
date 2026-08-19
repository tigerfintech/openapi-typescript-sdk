import type { TradeTickData } from './pb/TradeTickData';

const PART_CODE_NAME_MAP: Record<string, string> = {
  a: 'NYSE American, LLC (NYSE American)',
  b: 'NASDAQ OMX BX, Inc. (NASDAQ OMX BX)',
  c: 'NYSE National, Inc. (NYSE National)',
  d: 'FINRA Alternative Display Facility (ADF)',
  h: 'MIAX Pearl Exchange, LLC (MIAX)',
  i: 'International Securities Exchange, LLC (ISE)',
  j: 'Cboe EDGA Exchange, Inc. (Cboe EDGA)',
  k: 'Cboe EDGX Exchange, Inc. (Cboe EDGX)',
  l: 'Long-Term Stock Exchange, Inc. (LTSE)',
  m: 'NYSE Chicago, Inc. (NYSE Chicago)',
  n: 'New York Stock Exchange, LLC (NYSE)',
  p: 'NYSE Arca, Inc. (NYSE Arca)',
  s: 'Consolidated Tape System (CTS)',
  t: 'NASDAQ Stock Market, LLC (NASDAQ)',
  u: 'Members Exchange, LLC (MEMX)',
  v: "Investors' Exchange, LLC. (IEX)",
  w: 'CBOE Stock Exchange, Inc. (CBSX)',
  x: 'NASDAQ OMX PSX, Inc. (NASDAQ OMX PSX)',
  y: 'Cboe BYX Exchange, Inc. (Cboe BYX)',
  z: 'Cboe BZX Exchange, Inc. (Cboe BZX)',
};

const PART_CODE_SHORT_NAME_MAP: Record<string, string> = {
  a: 'AMEX',
  b: 'BX',
  c: 'NSX',
  d: 'ADF',
  h: 'MIAX',
  i: 'ISE',
  j: 'EDGA',
  k: 'EDGX',
  l: 'LTSE',
  m: 'CHO',
  n: 'NYSE',
  p: 'ARCA',
  s: 'CTS',
  t: 'NSDQ',
  u: 'MEMX',
  v: 'IEX',
  w: 'CBSX',
  x: 'PSX',
  y: 'BYX',
  z: 'BZX',
};

const US_TRADE_COND: Record<string, string> = {
  ' ': 'US_REGULAR_SALE',
  B: 'US_BUNCHED_TRADE',
  C: 'US_CASH_TRADE',
  F: 'US_INTERMARKET_SWEEP',
  G: 'US_BUNCHED_SOLD_TRADE',
  H: 'US_PRICE_VARIATION_TRADE',
  I: 'US_ODD_LOT_TRADE',
  K: 'US_RULE_127_OR_155_TRADE',
  L: 'US_SOLD_LAST',
  M: 'US_MARKET_CENTER_CLOSE_PRICE',
  N: 'US_NEXT_DAY_TRADE',
  O: 'US_MARKET_CENTER_OPENING_TRADE',
  P: 'US_PRIOR_REFERENCE_PRICE',
  Q: 'US_MARKET_CENTER_OPEN_PRICE',
  R: 'US_SELLER',
  T: 'US_FORM_T',
  U: 'US_EXTENDED_TRADING_HOURS',
  V: 'US_CONTINGENT_TRADE',
  W: 'US_AVERAGE_PRICE_TRADE',
  X: 'US_CROSS_TRADE',
  Z: 'US_SOLD_OUT_OF_SEQUENCE',
  '0': 'US_ODD_LOST_CROSS_TRADE',
  '4': 'US_DERIVATIVELY_PRICED',
  '5': 'US_MARKET_CENTER_RE_OPENING_TRADE',
  '6': 'US_MARKET_CENTER_CLOSING_TRADE',
  '7': 'US_QUALIFIED_CONTINGENT_TRADE',
  '9': 'US_CONSOLIDATED_LAST_PRICE_PER_LISTING_PACKET',
};

const HK_TRADE_COND: Record<string, string> = {
  ' ': 'HK_AUTOMATCH_NORMAL',
  D: 'HK_ODD_LOT_TRADE',
  U: 'HK_AUCTION_TRADE',
  '*': 'HK_OVERSEAS_TRADE',
  P: 'HK_LATE_TRADE_OFF_EXCHG',
  M: 'HK_NON_DIRECT_OFF_EXCHG_TRADE',
  X: 'HK_DIRECT_OFF_EXCHG_TRADE',
  Y: 'HK_AUTOMATIC_INTERNALIZED',
};

/** Returns the full exchange name for a partCode letter, or the raw code if unknown. */
export function getPartNameByCode(code: string): string {
  if (!code) return code;
  return PART_CODE_NAME_MAP[code] ?? code;
}

/** Returns the short exchange name for a partCode letter, or the raw code if unknown. */
export function getPartShortNameByCode(code: string): string {
  if (!code) return code;
  return PART_CODE_SHORT_NAME_MAP[code] ?? code;
}

/** Resolves a raw cond character to a readable string. */
export function getTradeCondByCode(isUs: boolean, ch: string): string {
  const map = isUs ? US_TRADE_COND : HK_TRADE_COND;
  return map[ch] ?? ch;
}

const US_SYMBOL_RE = /^[A-Z]+(\.[A-Z0-9]+)?$/;

/** Reports whether symbol is a US stock (uppercase letters, optional dot suffix). */
export function isUsStockSymbol(symbol: string): boolean {
  return US_SYMBOL_RE.test(symbol);
}

function isUsSymbol(symbol: string): boolean {
  return US_SYMBOL_RE.test(symbol);
}

function getTradeCond(isUs: boolean, ch: string): string {
  const map = isUs ? US_TRADE_COND : HK_TRADE_COND;
  return map[ch] ?? ch;
}

/** Single decoded tick from a push message. */
export interface PushTick {
  sn: number;
  time: number;
  price: number;
  volume: number;
  tickType: string;
  cond: string;
  partCode: string;
  partName: string;
}

/** Decoded push trade tick message — equivalent to Java TradeTick. */
export interface PushTradeTick {
  symbol: string;
  secType: string;
  quoteLevel: string;
  timestamp: number;
  ticks: PushTick[];
}

/** Decodes a TradeTickData pb message into a PushTradeTick with resolved partCode/partName. */
export function convertTradeTick(src: TradeTickData): PushTradeTick {
  if (src.secType === 'FUT') return convertFutureTick(src);
  return convertStockTick(src);
}

function convertStockTick(src: TradeTickData): PushTradeTick {
  const isUs = isUsSymbol(src.symbol);
  const denominator = Math.pow(10, src.priceOffset);
  const ticks: PushTick[] = [];
  let currentTime = 0;

  for (let i = 0; i < src.time.length; i++) {
    currentTime += src.time[i];
    const condCh = src.cond.length > i ? src.cond[i] : ' ';
    const rawCode = i < src.partCode.length ? src.partCode[i] : '';
    ticks.push({
      sn: src.sn + i,
      time: currentTime,
      price: (src.priceBase + src.price[i]) / denominator,
      volume: src.volume[i],
      tickType: src.type.length > i ? src.type[i] : '',
      cond: getTradeCond(isUs, condCh),
      partCode: getPartShortNameByCode(rawCode),
      partName: getPartNameByCode(rawCode),
    });
  }

  return { symbol: src.symbol, secType: src.secType, quoteLevel: src.quoteLevel, timestamp: src.timestamp, ticks };
}

function convertFutureTick(src: TradeTickData): PushTradeTick {
  const denominator = Math.pow(10, src.priceOffset);
  const ticks: PushTick[] = [];
  let currentTime = 0;
  let startSn = src.sn;

  for (let i = 0; i < src.time.length; i++) {
    currentTime += src.time[i];
    const curPrice = (src.priceBase + src.price[i]) / denominator;
    const mv = src.mergedVols[i];
    for (let j = 0; j < mv.vol.length; j++) {
      ticks.push({
        sn: startSn * 10 + j,
        time: currentTime,
        price: curPrice,
        volume: mv.vol[j],
        tickType: '',
        cond: '',
        partCode: '',
        partName: '',
      });
    }
    startSn++;
  }

  return { symbol: src.symbol, secType: src.secType, quoteLevel: '', timestamp: src.timestamp, ticks };
}
