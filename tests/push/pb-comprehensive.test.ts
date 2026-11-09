/**
 * Comprehensive protobuf encode/decode roundtrip tests for push/pb data types.
 *
 * Tests ALL fields (including nested types) to maximize coverage of
 * the generated encode/decode/fromPartial code paths.
 */
import { describe, it, expect } from 'vitest';
import { OptionTopData } from '../../src/push/pb/OptionTopData';
import { StockTopData } from '../../src/push/pb/StockTopData';
import { TickData } from '../../src/push/pb/TickData';
import { QuoteData } from '../../src/push/pb/QuoteData';
import { QuoteBasicData } from '../../src/push/pb/QuoteBasicData';
import { OrderStatusData } from '../../src/push/pb/OrderStatusData';
import { OrderTransactionData } from '../../src/push/pb/OrderTransactionData';
import { PositionData } from '../../src/push/pb/PositionData';
import { TradeTickData } from '../../src/push/pb/TradeTickData';
import { AssetData } from '../../src/push/pb/AssetData';

/** Encode then decode a message and return the decoded result. */
function roundtrip<T>(
  msgObj: { encode: (m: T, w?: any) => { finish: () => Uint8Array }; decode: (input: Uint8Array | any, length?: number) => T },
  msg: T,
): T {
  const bytes = msgObj.encode(msg).finish();
  return msgObj.decode(bytes);
}

describe('OptionTopData comprehensive', () => {
  it('roundtrip with all fields including nested topData', () => {
    const msg = OptionTopData.fromPartial({
      market: 'US',
      timestamp: 1700000000,
      topData: [{
        targetName: 'AAPL',
        bigOrder: [],
        item: [],
      }],
    });
    const decoded = roundtrip(OptionTopData, msg);
    expect(decoded.market).toBe('US');
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.topData).toHaveLength(1);
    expect(decoded.topData[0].targetName).toBe('AAPL');
  });

  it('roundtrip with empty topData array', () => {
    const msg = OptionTopData.fromPartial({
      market: 'HK',
      timestamp: 0,
      topData: [],
    });
    const decoded = roundtrip(OptionTopData, msg);
    expect(decoded.market).toBe('HK');
    expect(decoded.topData).toEqual([]);
  });

  it('create returns base defaults', () => {
    const msg = OptionTopData.create();
    expect(msg.market).toBe('');
    expect(msg.timestamp).toBe(0);
    expect(msg.topData).toEqual([]);
  });

  it('decode handles empty bytes', () => {
    const decoded = OptionTopData.decode(new Uint8Array(0));
    expect(decoded.market).toBe('');
    expect(decoded.topData).toEqual([]);
  });

  it('fromPartial with undefined topData', () => {
    const msg = OptionTopData.fromPartial({ market: 'US' });
    expect(msg.market).toBe('US');
    expect(msg.topData).toEqual([]);
  });
});

describe('StockTopData comprehensive', () => {
  it('roundtrip with all fields including nested topData', () => {
    const msg = StockTopData.fromPartial({
      market: 'US',
      timestamp: 1700000000,
      topData: [{
        targetName: 'AAPL',
        item: [],
      }],
    });
    const decoded = roundtrip(StockTopData, msg);
    expect(decoded.market).toBe('US');
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.topData).toHaveLength(1);
    expect(decoded.topData[0].targetName).toBe('AAPL');
  });

  it('create returns base defaults', () => {
    const msg = StockTopData.create();
    expect(msg.market).toBe('');
    expect(msg.timestamp).toBe(0);
    expect(msg.topData).toEqual([]);
  });

  it('decode handles empty bytes', () => {
    const decoded = StockTopData.decode(new Uint8Array(0));
    expect(decoded.market).toBe('');
  });
});

describe('TickData comprehensive', () => {
  it('roundtrip with all fields including nested ticks', () => {
    const msg = TickData.fromPartial({
      symbol: 'AAPL',
      ticks: [{
        sn: 1,
        time: 1700000000,
        price: 150.5,
        volume: 100,
        type: 'up',
        cond: 'test',
        partCode: 'NSDQ',
      }],
      timestamp: 1700000000,
      source: 'realtime',
    });
    const decoded = roundtrip(TickData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.source).toBe('realtime');
    expect(decoded.ticks).toHaveLength(1);
    expect(decoded.ticks[0].sn).toBe(1);
    expect(decoded.ticks[0].price).toBe(150.5);
    expect(decoded.ticks[0].type).toBe('up');
    expect(decoded.ticks[0].partCode).toBe('NSDQ');
  });

  it('roundtrip with empty ticks array', () => {
    const msg = TickData.fromPartial({ symbol: 'GOOG', ticks: [] });
    const decoded = roundtrip(TickData, msg);
    expect(decoded.symbol).toBe('GOOG');
    expect(decoded.ticks).toEqual([]);
  });

  it('create returns base defaults', () => {
    const msg = TickData.create();
    expect(msg.symbol).toBe('');
    expect(msg.ticks).toEqual([]);
    expect(msg.timestamp).toBe(0);
    expect(msg.source).toBe('');
  });
});

describe('QuoteData comprehensive', () => {
  it('roundtrip with all scalar fields', () => {
    const msg = QuoteData.fromPartial({
      symbol: 'AAPL',
      type: 3,
      timestamp: 1700000000,
      serverTimestamp: 1700000001,
      avgPrice: 150.5,
      latestPrice: 151.0,
      latestPriceTimestamp: 1700000002,
      latestTime: '10:00:00',
      preClose: 149.0,
      volume: 1000000,
      amount: 150000000,
      open: 149.5,
      high: 152.0,
      low: 148.0,
      hourTradingTag: 'pre',
      marketStatus: 'TRADING',
      askPrice: 151.0,
      askSize: 100,
      askTimestamp: 1700000003,
      bidPrice: 149.5,
      bidSize: 200,
      bidTimestamp: 1700000004,
      identifier: 'AAPL123',
      openInt: 5000,
      tradeTime: 1700000005,
      preSettlement: 148.0,
      minTick: 0.01,
      volumeDecimal: 2,
    });
    const decoded = roundtrip(QuoteData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.type).toBe(3);
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.latestPrice).toBe(151.0);
    expect(decoded.preClose).toBe(149.0);
    expect(decoded.volume).toBe(1000000);
    expect(decoded.open).toBe(149.5);
    expect(decoded.high).toBe(152.0);
    expect(decoded.low).toBe(148.0);
  });

  it('roundtrip with minute data', () => {
    const msg = QuoteData.fromPartial({
      symbol: 'AAPL',
      type: 1,
      timestamp: 1700000000,
      mi: { p: 150.0, a: 150.5, t: 1700000000, v: 100, o: 149.5, h: 151.0, l: 149.0 },
    });
    const decoded = roundtrip(QuoteData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.mi).toBeDefined();
    expect(decoded.mi!.p).toBe(150.0);
    expect(decoded.mi!.v).toBe(100);
    expect(decoded.mi!.o).toBe(149.5);
  });

  it('create returns base defaults', () => {
    const msg = QuoteData.create();
    expect(msg.symbol).toBe('');
    expect(msg.type).toBe(0);
    expect(msg.timestamp).toBe(0);
  });

  it('decode handles empty bytes', () => {
    const decoded = QuoteData.decode(new Uint8Array(0));
    expect(decoded.symbol).toBe('');
  });
});

describe('QuoteBasicData comprehensive', () => {
  it('roundtrip with all fields', () => {
    const msg = QuoteBasicData.fromPartial({
      symbol: 'AAPL',
      type: 1,
      timestamp: 1700000000,
      serverTimestamp: 1700000001,
      avgPrice: 150.5,
      latestPrice: 151.0,
      latestPriceTimestamp: 1700000002,
      latestTime: '10:00:00',
      preClose: 149.0,
      volume: 1000000,
      amount: 150000000,
      open: 149.5,
      high: 152.0,
      low: 148.0,
      hourTradingTag: 'pre',
      marketStatus: 'TRADING',
      identifier: 'AAPL123',
      openInt: 5000,
      tradeTime: 1700000005,
      preSettlement: 148.0,
      minTick: 0.01,
      mi: { p: 150.0, a: 150.5, t: 1700000000, v: 100, o: 149.5, h: 151.0, l: 149.0 },
      volumeDecimal: 2,
    });
    const decoded = roundtrip(QuoteBasicData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.type).toBe(1);
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.avgPrice).toBe(150.5);
    expect(decoded.latestPrice).toBe(151.0);
    expect(decoded.preClose).toBe(149.0);
    expect(decoded.volume).toBe(1000000);
    expect(decoded.hourTradingTag).toBe('pre');
    expect(decoded.marketStatus).toBe('TRADING');
    expect(decoded.identifier).toBe('AAPL123');
  });

  it('create returns base defaults', () => {
    const msg = QuoteBasicData.create();
    expect(msg.symbol).toBe('');
    expect(msg.type).toBe(0);
    expect(msg.timestamp).toBe(0);
  });
});

describe('OrderStatusData comprehensive', () => {
  it('roundtrip with all fields', () => {
    const msg = OrderStatusData.fromPartial({
      id: 12345,
      account: 'acc1',
      symbol: 'AAPL',
      expiry: '20260619',
      strike: '150',
      right: 'CALL',
      identifier: 'AAPL240119C00150000',
      multiplier: 100,
      action: 'BUY',
      market: 'US',
      currency: 'USD',
      segType: 'CASH',
      secType: 'OPT',
      orderType: 'LMT',
      isLong: true,
      totalQuantity: 100,
      totalQuantityScale: 0,
      filledQuantity: 50,
      filledQuantityScale: 0,
      avgFillPrice: 150.0,
      limitPrice: 151.0,
      stopPrice: 0,
      realizedPnl: 500,
      status: 'Filled',
      replaceStatus: '',
      cancelStatus: '',
      outsideRth: true,
      canModify: true,
      canCancel: true,
    });
    const decoded = roundtrip(OrderStatusData, msg);
    expect(decoded.id).toBe(12345);
    expect(decoded.account).toBe('acc1');
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.expiry).toBe('20260619');
    expect(decoded.strike).toBe('150');
    expect(decoded.right).toBe('CALL');
    expect(decoded.action).toBe('BUY');
    expect(decoded.orderType).toBe('LMT');
    expect(decoded.isLong).toBe(true);
    expect(decoded.totalQuantity).toBe(100);
    expect(decoded.filledQuantity).toBe(50);
    expect(decoded.avgFillPrice).toBe(150.0);
    expect(decoded.status).toBe('Filled');
    expect(decoded.outsideRth).toBe(true);
    expect(decoded.canModify).toBe(true);
  });

  it('create returns base defaults', () => {
    const msg = OrderStatusData.create();
    expect(msg.account).toBe('');
    expect(msg.symbol).toBe('');
    expect(msg.isLong).toBe(false);
    expect(msg.totalQuantity).toBe(0);
  });

  it('decode handles empty bytes', () => {
    const decoded = OrderStatusData.decode(new Uint8Array(0));
    expect(decoded.account).toBe('');
  });
});

describe('OrderTransactionData comprehensive', () => {
  it('roundtrip with all fields', () => {
    const msg = OrderTransactionData.fromPartial({
      id: 12345,
      orderId: 67890,
      account: 'acc1',
      symbol: 'AAPL',
      identifier: 'AAPL123',
      multiplier: 100,
      action: 'BUY',
      market: 'US',
      currency: 'USD',
      segType: 'CASH',
      secType: 'STK',
      filledPrice: 150.0,
      filledQuantity: 100,
      createTime: 1700000000,
      updateTime: 1700000001,
      transactTime: 1700000002,
      timestamp: 1700000003,
    });
    const decoded = roundtrip(OrderTransactionData, msg);
    expect(decoded.id).toBe(12345);
    expect(decoded.orderId).toBe(67890);
    expect(decoded.account).toBe('acc1');
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.action).toBe('BUY');
    expect(decoded.filledPrice).toBe(150.0);
    expect(decoded.filledQuantity).toBe(100);
    expect(decoded.createTime).toBe(1700000000);
  });

  it('create returns base defaults', () => {
    const msg = OrderTransactionData.create();
    expect(msg.account).toBe('');
    expect(msg.filledPrice).toBe(0);
  });
});

describe('PositionData comprehensive', () => {
  it('roundtrip with all fields', () => {
    const msg = PositionData.fromPartial({
      account: 'acc1',
      symbol: 'AAPL',
      expiry: '20260619',
      strike: '150',
      right: 'CALL',
      identifier: 'AAPL123',
      multiplier: 100,
      market: 'US',
      currency: 'USD',
      segType: 'CASH',
      secType: 'STK',
      position: 100,
      positionScale: 0,
      averageCost: 150.0,
      latestPrice: 151.0,
      marketValue: 15100,
      unrealizedPnl: 100,
      name: 'Apple',
      timestamp: 1700000000,
      saleable: 100,
      positionQty: 100,
      salableQty: 80,
    });
    const decoded = roundtrip(PositionData, msg);
    expect(decoded.account).toBe('acc1');
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.position).toBe(100);
    expect(decoded.averageCost).toBe(150.0);
    expect(decoded.latestPrice).toBe(151.0);
    expect(decoded.marketValue).toBe(15100);
    expect(decoded.name).toBe('Apple');
    expect(decoded.salableQty).toBe(80);
  });

  it('create returns base defaults', () => {
    const msg = PositionData.create();
    expect(msg.account).toBe('');
    expect(msg.position).toBe(0);
  });
});

describe('TradeTickData comprehensive', () => {
  it('roundtrip with all fields', () => {
    const msg = TradeTickData.fromPartial({
      symbol: 'AAPL',
      type: 'test',
      cond: 'cond1',
      sn: 1,
      priceBase: 10000,
      priceOffset: 100,
      time: [1700000000, 1700000001],
      price: [15000, 15100],
      volume: [100, 200],
      partCode: ['NSDQ', 'NYSE'],
      quoteLevel: '1',
      timestamp: 1700000000,
      secType: 'STK',
      mergedVols: [100, 200],
    });
    const decoded = roundtrip(TradeTickData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.type).toBe('test');
    expect(decoded.cond).toBe('cond1');
    expect(decoded.sn).toBe(1);
    expect(decoded.priceBase).toBe(10000);
    expect(decoded.time).toEqual([1700000000, 1700000001]);
    expect(decoded.price).toEqual([15000, 15100]);
    expect(decoded.volume).toEqual([100, 200]);
    expect(decoded.partCode).toEqual(['NSDQ', 'NYSE']);
    expect(decoded.secType).toBe('STK');
  });

  it('create returns base defaults', () => {
    const msg = TradeTickData.create();
    expect(msg.symbol).toBe('');
    expect(msg.time).toEqual([]);
    expect(msg.price).toEqual([]);
  });
});

describe('AssetData comprehensive', () => {
  it('roundtrip with all fields', () => {
    const msg = AssetData.fromPartial({
      account: 'acc1',
      currency: 'USD',
      segType: 'CASH',
      availableFunds: 10000,
      excessLiquidity: 5000,
      netLiquidation: 50000,
      equityWithLoan: 45000,
      buyingPower: 20000,
      cashBalance: 10000,
      grossPositionValue: 40000,
      initMarginReq: 5000,
      maintMarginReq: 3000,
      timestamp: 1700000000,
    });
    const decoded = roundtrip(AssetData, msg);
    expect(decoded.account).toBe('acc1');
    expect(decoded.currency).toBe('USD');
    expect(decoded.segType).toBe('CASH');
    expect(decoded.availableFunds).toBe(10000);
    expect(decoded.excessLiquidity).toBe(5000);
    expect(decoded.netLiquidation).toBe(50000);
    expect(decoded.equityWithLoan).toBe(45000);
    expect(decoded.buyingPower).toBe(20000);
    expect(decoded.cashBalance).toBe(10000);
    expect(decoded.grossPositionValue).toBe(40000);
    expect(decoded.initMarginReq).toBe(5000);
    expect(decoded.maintMarginReq).toBe(3000);
    expect(decoded.timestamp).toBe(1700000000);
  });

  it('create returns base defaults', () => {
    const msg = AssetData.create();
    expect(msg.account).toBe('');
    expect(msg.availableFunds).toBe(0);
  });

  it('decode handles empty bytes', () => {
    const decoded = AssetData.decode(new Uint8Array(0));
    expect(decoded.account).toBe('');
  });
});
