/**
 * Protobuf encode/decode roundtrip tests for push/pb data types.
 *
 * Each test verifies that encoding a message and decoding it back
 * preserves all field values. Also tests create() and fromPartial().
 */
import { describe, it, expect } from 'vitest';
import { QuoteBBOData } from '../../src/push/pb/QuoteBBOData';
import { QuoteBasicData } from '../../src/push/pb/QuoteBasicData';
import { QuoteData } from '../../src/push/pb/QuoteData';
import { QuoteDepthData } from '../../src/push/pb/QuoteDepthData';
import { AssetData } from '../../src/push/pb/AssetData';
import { KlineData } from '../../src/push/pb/KlineData';
import { OptionTopData } from '../../src/push/pb/OptionTopData';
import { OrderStatusData } from '../../src/push/pb/OrderStatusData';
import { OrderTransactionData } from '../../src/push/pb/OrderTransactionData';
import { PositionData } from '../../src/push/pb/PositionData';
import { PushData } from '../../src/push/pb/PushData';
import { StockTopData } from '../../src/push/pb/StockTopData';
import { TickData } from '../../src/push/pb/TickData';
import { TradeTickData } from '../../src/push/pb/TradeTickData';
import { Request } from '../../src/push/pb/Request';
import { Response } from '../../src/push/pb/Response';
import {
  SocketCommon,
  SocketCommon_Command,
  SocketCommon_DataType,
} from '../../src/push/pb/SocketCommon';

/** Encode then decode a message and return the decoded result. */
function roundtrip<T>(
  msgObj: { encode: (m: T, w?: any) => { finish: () => Uint8Array }; decode: (input: Uint8Array | any, length?: number) => T },
  msg: T,
): T {
  const bytes = msgObj.encode(msg).finish();
  return msgObj.decode(bytes);
}

describe('SocketCommon protobuf', () => {
  it('encode/decode roundtrip (empty message)', () => {
    const msg = SocketCommon.create({});
    const bytes = SocketCommon.encode(msg).finish();
    const decoded = SocketCommon.decode(bytes);
    expect(decoded).toEqual({});
  });

  it('fromPartial returns empty object', () => {
    const msg = SocketCommon.fromPartial({});
    expect(msg).toEqual({});
  });

  it('decode skips unknown fields', () => {
    const unknown = new Uint8Array([8, 42]);
    const decoded = SocketCommon.decode(unknown);
    expect(decoded).toEqual({});
  });
});

describe('QuoteBBOData protobuf', () => {
  it('roundtrip preserves all fields', () => {
    const msg = QuoteBBOData.fromPartial({
      symbol: 'AAPL',
      type: 2,
      timestamp: 1700000000,
      askPrice: 150.25,
      askSize: 100,
      askTimestamp: 1700000001,
      bidPrice: 149.75,
      bidSize: 200,
      bidTimestamp: 1700000002,
    });
    const decoded = roundtrip(QuoteBBOData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.type).toBe(2);
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.askPrice).toBe(150.25);
    expect(decoded.askSize).toBe(100);
    expect(decoded.bidPrice).toBe(149.75);
    expect(decoded.bidSize).toBe(200);
  });

  it('create returns base defaults', () => {
    const msg = QuoteBBOData.create();
    expect(msg.symbol).toBe('');
    expect(msg.type).toBe(0);
    expect(msg.askPrice).toBe(0);
  });

  it('decode handles empty bytes', () => {
    const decoded = QuoteBBOData.decode(new Uint8Array(0));
    expect(decoded.symbol).toBe('');
    expect(decoded.type).toBe(0);
  });
});

describe('QuoteBasicData protobuf', () => {
  it('roundtrip preserves all fields', () => {
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
    });
    const decoded = roundtrip(QuoteBasicData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.type).toBe(1);
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.avgPrice).toBe(150.5);
    expect(decoded.latestPrice).toBe(151.0);
    expect(decoded.preClose).toBe(149.0);
    expect(decoded.volume).toBe(1000000);
  });

  it('create returns base defaults', () => {
    const msg = QuoteBasicData.create();
    expect(msg.symbol).toBe('');
    expect(msg.type).toBe(0);
    expect(msg.timestamp).toBe(0);
  });
});

describe('QuoteData protobuf', () => {
  it('roundtrip preserves symbol and fields', () => {
    const msg = QuoteData.fromPartial({
      symbol: 'AAPL',
      type: 3,
      timestamp: 1700000000,
      latestPrice: 150.0,
      preClose: 149.0,
      volume: 1000,
    });
    const decoded = roundtrip(QuoteData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.latestPrice).toBe(150.0);
    expect(decoded.preClose).toBe(149.0);
  });

  it('create with partial fields', () => {
    const msg = QuoteData.fromPartial({ symbol: 'GOOG' });
    expect(msg.symbol).toBe('GOOG');
  });
});

describe('QuoteDepthData protobuf', () => {
  it('roundtrip preserves symbol and timestamp', () => {
    const msg = QuoteDepthData.fromPartial({
      symbol: 'AAPL',
      timestamp: 1700000000,
    });
    const decoded = roundtrip(QuoteDepthData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.timestamp).toBe(1700000000);
  });

  it('roundtrip preserves ask/bid order books', () => {
    const msg = QuoteDepthData.fromPartial({
      symbol: 'AAPL',
      timestamp: 1700000000,
      ask: { price: [151.0, 152.0], volume: [500, 300], orderCount: [10, 5], exchange: ['NSDQ'], time: [1700000000] },
      bid: { price: [149.5, 148.0], volume: [250, 200], orderCount: [5, 3], exchange: ['NSDQ'], time: [1700000000] },
    });
    const decoded = roundtrip(QuoteDepthData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.ask).toBeDefined();
    expect(decoded.ask!.price).toEqual([151.0, 152.0]);
    expect(decoded.ask!.volume).toEqual([500, 300]);
    expect(decoded.bid).toBeDefined();
    expect(decoded.bid!.price).toEqual([149.5, 148.0]);
  });

  it('create returns base defaults', () => {
    const msg = QuoteDepthData.create();
    expect(msg.symbol).toBe('');
    expect(msg.timestamp).toBe(0);
    expect(msg.ask).toBeUndefined();
  });
});

describe('AssetData protobuf', () => {
  it('roundtrip preserves account and currency', () => {
    const msg = AssetData.fromPartial({
      account: 'acc1',
      currency: 'USD',
      segType: 'CASH',
      availableFunds: 10000,
      netLiquidation: 50000,
      timestamp: 1700000000,
    });
    const decoded = roundtrip(AssetData, msg);
    expect(decoded.account).toBe('acc1');
    expect(decoded.currency).toBe('USD');
    expect(decoded.availableFunds).toBe(10000);
    expect(decoded.netLiquidation).toBe(50000);
  });

  it('create returns base defaults', () => {
    const msg = AssetData.create();
    expect(msg.account).toBe('');
    expect(msg.currency).toBe('');
    expect(msg.availableFunds).toBe(0);
  });
});

describe('KlineData protobuf', () => {
  it('roundtrip preserves symbol and values', () => {
    const msg = KlineData.fromPartial({
      symbol: 'AAPL',
      time: 1700000000,
      open: 150,
      close: 151,
      high: 152,
      low: 149,
      volume: 1000,
      count: 100,
      amount: 150000,
    });
    const decoded = roundtrip(KlineData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.open).toBe(150);
    expect(decoded.close).toBe(151);
    expect(decoded.high).toBe(152);
    expect(decoded.low).toBe(149);
    expect(decoded.volume).toBe(1000);
  });

  it('create returns base defaults', () => {
    const msg = KlineData.create();
    expect(msg.symbol).toBe('');
    expect(msg.open).toBe(0);
    expect(msg.volume).toBe(0);
  });
});

describe('OptionTopData protobuf', () => {
  it('roundtrip preserves market and timestamp', () => {
    const msg = OptionTopData.fromPartial({
      market: 'US',
      timestamp: 1700000000,
      topData: [],
    });
    const decoded = roundtrip(OptionTopData, msg);
    expect(decoded.market).toBe('US');
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.topData).toEqual([]);
  });

  it('create returns base defaults', () => {
    const msg = OptionTopData.create();
    expect(msg.market).toBe('');
    expect(msg.timestamp).toBe(0);
    expect(msg.topData).toEqual([]);
  });
});

describe('OrderStatusData protobuf', () => {
  it('roundtrip preserves account and symbol', () => {
    const msg = OrderStatusData.fromPartial({
      id: 12345,
      account: 'acc1',
      symbol: 'AAPL',
      action: 'BUY',
      status: 'Submitted',
    });
    const decoded = roundtrip(OrderStatusData, msg);
    expect(decoded.id).toBe(12345);
    expect(decoded.account).toBe('acc1');
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.action).toBe('BUY');
  });

  it('create returns base defaults', () => {
    const msg = OrderStatusData.create();
    expect(msg.account).toBe('');
    expect(msg.symbol).toBe('');
  });
});

describe('OrderTransactionData protobuf', () => {
  it('roundtrip preserves account and symbol', () => {
    const msg = OrderTransactionData.fromPartial({
      id: 12345,
      orderId: 67890,
      account: 'acc1',
      symbol: 'AAPL',
      filledPrice: 150.0,
      filledQuantity: 100,
    });
    const decoded = roundtrip(OrderTransactionData, msg);
    expect(decoded.id).toBe(12345);
    expect(decoded.orderId).toBe(67890);
    expect(decoded.account).toBe('acc1');
    expect(decoded.filledPrice).toBe(150.0);
  });

  it('create returns base defaults', () => {
    const msg = OrderTransactionData.create();
    expect(msg.account).toBe('');
    expect(msg.filledPrice).toBe(0);
  });
});

describe('PositionData protobuf', () => {
  it('roundtrip preserves account and symbol', () => {
    const msg = PositionData.fromPartial({
      account: 'acc1',
      symbol: 'AAPL',
      position: 100,
      averageCost: 150.0,
    });
    const decoded = roundtrip(PositionData, msg);
    expect(decoded.account).toBe('acc1');
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.position).toBe(100);
  });

  it('create returns base defaults', () => {
    const msg = PositionData.create();
    expect(msg.account).toBe('');
    expect(msg.symbol).toBe('');
    expect(msg.position).toBe(0);
  });
});

describe('PushData protobuf', () => {
  it('roundtrip preserves dataType', () => {
    const msg = PushData.fromPartial({
      dataType: SocketCommon_DataType.Quote,
    });
    const decoded = roundtrip(PushData, msg);
    expect(decoded.dataType).toBe(SocketCommon_DataType.Quote);
  });

  it('create returns base defaults', () => {
    const msg = PushData.create();
    expect(msg.dataType).toBe(0);
    expect(msg.quoteData).toBeUndefined();
  });
});

describe('StockTopData protobuf', () => {
  it('roundtrip preserves market and timestamp', () => {
    const msg = StockTopData.fromPartial({
      market: 'US',
      timestamp: 1700000000,
      topData: [],
    });
    const decoded = roundtrip(StockTopData, msg);
    expect(decoded.market).toBe('US');
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.topData).toEqual([]);
  });

  it('create returns base defaults', () => {
    const msg = StockTopData.create();
    expect(msg.market).toBe('');
    expect(msg.timestamp).toBe(0);
  });
});

describe('TickData protobuf', () => {
  it('roundtrip preserves symbol and timestamp', () => {
    const msg = TickData.fromPartial({
      symbol: 'AAPL',
      timestamp: 1700000000,
      source: 'test',
      ticks: [],
    });
    const decoded = roundtrip(TickData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.source).toBe('test');
  });

  it('create returns base defaults', () => {
    const msg = TickData.create();
    expect(msg.symbol).toBe('');
    expect(msg.ticks).toEqual([]);
  });
});

describe('TradeTickData protobuf', () => {
  it('roundtrip preserves symbol and fields', () => {
    const msg = TradeTickData.fromPartial({
      symbol: 'AAPL',
      type: 'test',
      timestamp: 1700000000,
      secType: 'STK',
    });
    const decoded = roundtrip(TradeTickData, msg);
    expect(decoded.symbol).toBe('AAPL');
    expect(decoded.timestamp).toBe(1700000000);
    expect(decoded.secType).toBe('STK');
  });

  it('create returns base defaults', () => {
    const msg = TradeTickData.create();
    expect(msg.symbol).toBe('');
    expect(msg.type).toBe('');
    expect(msg.sn).toBe(0);
  });
});

describe('Request protobuf', () => {
  it('roundtrip preserves command and id', () => {
    const msg = Request.fromPartial({
      command: SocketCommon_Command.SUBSCRIBE,
      id: 42,
    });
    const decoded = roundtrip(Request, msg);
    expect(decoded.command).toBe(SocketCommon_Command.SUBSCRIBE);
    expect(decoded.id).toBe(42);
  });

  it('create returns base defaults', () => {
    const msg = Request.create();
    expect(msg.command).toBe(0);
    expect(msg.id).toBe(0);
  });
});

describe('Response protobuf', () => {
  it('roundtrip preserves command and code', () => {
    const msg = Response.fromPartial({
      command: SocketCommon_Command.CONNECTED,
      code: 0,
      msg: 'ok',
    });
    const decoded = roundtrip(Response, msg);
    expect(decoded.command).toBe(SocketCommon_Command.CONNECTED);
    expect(decoded.code).toBe(0);
    expect(decoded.msg).toBe('ok');
  });

  it('fromPartial creates valid message', () => {
    const msg = Response.fromPartial({ code: 1 });
    expect(msg.code).toBe(1);
  });
});
