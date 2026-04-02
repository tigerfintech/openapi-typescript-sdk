/**
 * 订单构造工具函数测试
 */
import { describe, it, expect } from 'vitest';
import {
  marketOrder,
  limitOrder,
  stopOrder,
  stopLimitOrder,
  trailOrder,
  auctionLimitOrder,
  auctionMarketOrder,
  algoOrder,
  orderLeg,
} from '../../src/model/order-helpers';
import { OrderType, TimeInForce } from '../../src/model/enums';

describe('marketOrder', () => {
  it('应构造市价单', () => {
    const o = marketOrder('DU123', 'AAPL', 'STK', 'BUY', 100);
    expect(o.account).toBe('DU123');
    expect(o.symbol).toBe('AAPL');
    expect(o.secType).toBe('STK');
    expect(o.action).toBe('BUY');
    expect(o.orderType).toBe(OrderType.MKT);
    expect(o.totalQuantity).toBe(100);
    expect(o.timeInForce).toBe(TimeInForce.DAY);
  });
});

describe('limitOrder', () => {
  it('应构造限价单', () => {
    const o = limitOrder('DU123', 'AAPL', 'STK', 'BUY', 100, 150.5);
    expect(o.orderType).toBe(OrderType.LMT);
    expect(o.limitPrice).toBe(150.5);
    expect(o.timeInForce).toBe(TimeInForce.DAY);
  });
});

describe('stopOrder', () => {
  it('应构造止损单', () => {
    const o = stopOrder('DU123', 'AAPL', 'STK', 'SELL', 100, 140.0);
    expect(o.orderType).toBe(OrderType.STP);
    expect(o.auxPrice).toBe(140.0);
  });
});

describe('stopLimitOrder', () => {
  it('应构造止损限价单', () => {
    const o = stopLimitOrder('DU123', 'AAPL', 'STK', 'SELL', 100, 145.0, 140.0);
    expect(o.orderType).toBe(OrderType.STP_LMT);
    expect(o.limitPrice).toBe(145.0);
    expect(o.auxPrice).toBe(140.0);
  });
});

describe('trailOrder', () => {
  it('应构造跟踪止损单', () => {
    const o = trailOrder('DU123', 'AAPL', 'STK', 'SELL', 100, 5.0);
    expect(o.orderType).toBe(OrderType.TRAIL);
    expect(o.trailingPercent).toBe(5.0);
  });
});

describe('auctionLimitOrder', () => {
  it('应构造竞价限价单', () => {
    const o = auctionLimitOrder('DU123', 'AAPL', 'STK', 'BUY', 100, 150.0);
    expect(o.orderType).toBe(OrderType.AL);
    expect(o.limitPrice).toBe(150.0);
  });
});

describe('auctionMarketOrder', () => {
  it('应构造竞价市价单', () => {
    const o = auctionMarketOrder('DU123', 'AAPL', 'STK', 'BUY', 100);
    expect(o.orderType).toBe(OrderType.AM);
    expect(o.totalQuantity).toBe(100);
  });
});

describe('algoOrder', () => {
  it('应构造 TWAP 算法订单', () => {
    const params = {
      algoStrategy: 'TWAP',
      startTime: '09:30:00',
      endTime: '16:00:00',
      participationRate: 0.1,
    };
    const o = algoOrder('DU123', 'AAPL', 'STK', 'BUY', 1000, 150.0, 'TWAP', params);
    expect(o.orderType).toBe('TWAP');
    expect(o.algoParams).toEqual(params);
    expect(o.limitPrice).toBe(150.0);
  });

  it('应构造 VWAP 算法订单', () => {
    const params = { algoStrategy: 'VWAP' };
    const o = algoOrder('DU123', 'AAPL', 'STK', 'BUY', 500, 150.0, 'VWAP', params);
    expect(o.orderType).toBe('VWAP');
    expect(o.algoParams?.algoStrategy).toBe('VWAP');
  });
});

describe('orderLeg', () => {
  it('应构造止盈附加订单', () => {
    const leg = orderLeg('PROFIT', 160.0, 'GTC');
    expect(leg.legType).toBe('PROFIT');
    expect(leg.price).toBe(160.0);
    expect(leg.timeInForce).toBe('GTC');
  });

  it('应构造止损附加订单', () => {
    const leg = orderLeg('LOSS', 140.0, 'GTC');
    expect(leg.legType).toBe('LOSS');
    expect(leg.price).toBe(140.0);
  });
});
