import { describe, it, expect } from 'vitest';
import {
  getPartNameByCode,
  getPartShortNameByCode,
  convertTradeTick,
  isUsStockSymbol,
} from '../../src/push/tick-util';
import type { TradeTickData } from '../../src/push/pb/TradeTickData';

describe('getPartShortNameByCode', () => {
  it('known codes return short name', () => {
    expect(getPartShortNameByCode('n')).toBe('NYSE');
    expect(getPartShortNameByCode('t')).toBe('NSDQ');
    expect(getPartShortNameByCode('p')).toBe('ARCA');
    expect(getPartShortNameByCode('z')).toBe('BZX');
    expect(getPartShortNameByCode('a')).toBe('AMEX');
  });
  it('unknown code returns raw code', () => {
    expect(getPartShortNameByCode('?')).toBe('?');
  });
  it('empty string returns empty', () => {
    expect(getPartShortNameByCode('')).toBe('');
  });
});

describe('getPartNameByCode', () => {
  it('known codes return full name', () => {
    expect(getPartNameByCode('n')).toBe('New York Stock Exchange, LLC (NYSE)');
    expect(getPartNameByCode('t')).toBe('NASDAQ Stock Market, LLC (NASDAQ)');
  });
  it('unknown code returns raw code', () => {
    expect(getPartNameByCode('?')).toBe('?');
  });
});

function makeStockData(overrides: Partial<TradeTickData> = {}): TradeTickData {
  return {
    symbol: 'AAPL',
    secType: 'STK',
    quoteLevel: 'L1',
    timestamp: 1700000000,
    sn: 100,
    priceBase: 1500000,
    priceOffset: 4,
    time: [1000, 500, 300],
    price: [0, 100, -50],
    volume: [200, 100, 150],
    partCode: ['n', 't', 'p'],
    cond: 'B T',
    type: '+-*',
    mergedVols: [],
    ...overrides,
  };
}

describe('convertTradeTick — stock', () => {
  it('decodes cumulative time', () => {
    const out = convertTradeTick(makeStockData());
    expect(out.ticks[0].time).toBe(1000);
    expect(out.ticks[1].time).toBe(1500);
    expect(out.ticks[2].time).toBe(1800);
  });

  it('decodes price correctly', () => {
    const out = convertTradeTick(makeStockData());
    expect(out.ticks[0].price).toBeCloseTo((1500000 + 0) / 10000);
    expect(out.ticks[1].price).toBeCloseTo((1500000 + 100) / 10000);
  });

  it('resolves partCode and partName', () => {
    const out = convertTradeTick(makeStockData());
    expect(out.ticks[0].partCode).toBe('NYSE');
    expect(out.ticks[0].partName).toBe('New York Stock Exchange, LLC (NYSE)');
    expect(out.ticks[1].partCode).toBe('NSDQ');
    expect(out.ticks[2].partCode).toBe('ARCA');
  });

  it('resolves US trade condition', () => {
    const out = convertTradeTick(makeStockData());
    expect(out.ticks[0].cond).toBe('US_BUNCHED_TRADE');   // 'B'
    expect(out.ticks[1].cond).toBe('US_REGULAR_SALE');    // ' '
  });

  it('assigns sequential sn', () => {
    const out = convertTradeTick(makeStockData());
    expect(out.ticks[0].sn).toBe(100);
    expect(out.ticks[2].sn).toBe(102);
  });

  it('copies symbol / secType / quoteLevel / timestamp', () => {
    const out = convertTradeTick(makeStockData());
    expect(out.symbol).toBe('AAPL');
    expect(out.secType).toBe('STK');
    expect(out.quoteLevel).toBe('L1');
    expect(out.timestamp).toBe(1700000000);
  });
});

describe('convertTradeTick — HK cond', () => {
  it('resolves HK trade condition for .HK symbols', () => {
    const src = makeStockData({ symbol: '00700.HK', partCode: [], cond: 'U' });
    const out = convertTradeTick(src);
    expect(out.ticks[0].cond).toBe('HK_AUCTION_TRADE');
  });
});

describe('convertTradeTick — future', () => {
  it('decodes merged vols', () => {
    const src: TradeTickData = {
      symbol: 'ES2312',
      secType: 'FUT',
      quoteLevel: '',
      timestamp: 1700000000,
      sn: 10,
      priceBase: 45000000,
      priceOffset: 4,
      time: [1000, 500],
      price: [0, 100],
      volume: [],
      partCode: [],
      cond: '',
      type: '',
      mergedVols: [
        { mergeTimes: 2, vol: [100, 200] },
        { mergeTimes: 1, vol: [300] },
      ],
    };
    const out = convertTradeTick(src);
    expect(out.ticks).toHaveLength(3);
    expect(out.ticks[0].sn).toBe(100);  // 10*10+0
    expect(out.ticks[1].sn).toBe(101);  // 10*10+1
    expect(out.ticks[2].sn).toBe(110);  // 11*10+0
    expect(out.ticks[0].volume).toBe(100);
    expect(out.ticks[2].volume).toBe(300);
    expect(out.ticks[0].partCode).toBe('');
  });
});

describe('isUsStockSymbol', () => {
  it('returns true for plain US tickers', () => {
    expect(isUsStockSymbol('AAPL')).toBe(true);
    expect(isUsStockSymbol('TSLA')).toBe(true);
  });
  it('returns true for US option symbols with dot suffix', () => {
    expect(isUsStockSymbol('AAPL.US')).toBe(true);
  });
  it('returns false for HK numeric symbols', () => {
    expect(isUsStockSymbol('00700')).toBe(false);
    expect(isUsStockSymbol('09988')).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(isUsStockSymbol('')).toBe(false);
  });
});

describe('convertTradeTick HK cond', () => {
  it('uses HK trade condition map for numeric symbol', () => {
    const src = {
      symbol: '00700',
      secType: 'STK',
      quoteLevel: 'L1',
      timestamp: 1700000000000,
      sn: 1,
      priceBase: 30000,
      priceOffset: 2,
      time: [500],
      price: [0],
      volume: [1000],
      partCode: [],
      cond: ' ',
      type: '+',
      mergedVols: [],
    };
    const out = convertTradeTick(src);
    expect(out.ticks[0].cond).toBe('HK_AUTOMATCH_NORMAL');
  });
});
