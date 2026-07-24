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
  icebergOrder,
  marketOrderByAmount,
  limitOrderByAmount,
  trailOrderByPrice,
  limitOrderWithLegs,
  comboOrder,
  ocaOrder,
  contractLeg,
} from '../../src/model/order-helpers';
import { OrderType, TimeInForce, PriceType } from '../../src/model/enums';

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

describe('icebergOrder', () => {
  it('应构造冰山单（最简）', () => {
    const o = icebergOrder('DU123', 'AAPL', 'STK', 'BUY', 1000, 180.0, 100);
    expect(o.orderType).toBe('ICEBERG');
    expect(o.totalQuantity).toBe(1000);
    expect(o.limitPrice).toBe(180.0);
    expect(o.displaySize).toBe(100);
    expect(o.timeInForce).toBe('DAY');
    expect(o.minDisplaySize).toBeUndefined();
    expect(o.startTime).toBeUndefined();
  });
});

describe('icebergOrder (full params)', () => {
  it('应构造冰山单（完整参数）', () => {
    const startTime = 1782293585902;
    const endTime = 1782297185902;
    const o = icebergOrder('DU123', 'AAPL', 'STK', 'BUY', 1000, 180.0,
      100, 50, 30, PriceType.LIMIT_PRICE, startTime, endTime);
    expect(o.orderType).toBe('ICEBERG');
    expect(o.displaySize).toBe(100);
    expect(o.minDisplaySize).toBe(50);
    expect(o.checkIntervals).toBe(30);
    expect(o.priceType).toBe('LIMIT_PRICE');
    expect(o.startTime).toBe(startTime);
    expect(o.endTime).toBe(endTime);
  });

  it('startTime/endTime 为 0 时不设置', () => {
    const o = icebergOrder('DU123', 'AAPL', 'STK', 'BUY', 1000, 180.0, 100, 50, 30, 'ASK_PRICE', 0, 0);
    expect(o.startTime).toBeUndefined();
    expect(o.endTime).toBeUndefined();
  });
});

describe('marketOrderByAmount', () => {
  it('应构造按金额市价单', () => {
    const o = marketOrderByAmount('ACC', 'AAPL', 'STK', 'BUY', 5000);
    expect(o.orderType).toBe(OrderType.MKT);
    expect(o.cashAmount).toBe(5000);
    expect(o.totalQuantity).toBe(0);
    expect(o.timeInForce).toBe(TimeInForce.DAY);
  });
});

describe('limitOrderByAmount', () => {
  it('应构造按金额限价单', () => {
    const o = limitOrderByAmount('ACC', 'AAPL', 'STK', 'BUY', 5000, 150.0);
    expect(o.orderType).toBe(OrderType.LMT);
    expect(o.cashAmount).toBe(5000);
    expect(o.limitPrice).toBe(150.0);
    expect(o.totalQuantity).toBe(0);
  });
});

describe('trailOrderByPrice', () => {
  it('应构造按价差跟踪止损单', () => {
    const o = trailOrderByPrice('ACC', 'AAPL', 'STK', 'SELL', 100, 5.0);
    expect(o.orderType).toBe(OrderType.TRAIL);
    expect(o.auxPrice).toBe(5.0);
    expect(o.trailingPercent).toBeUndefined();
    expect(o.totalQuantity).toBe(100);
  });
});

describe('limitOrderWithLegs', () => {
  it('应构造带止盈腿的限价单', () => {
    const legs = [orderLeg('PROFIT', 200.0, 'GTC')];
    const o = limitOrderWithLegs('ACC', 'AAPL', 'STK', 'BUY', 100, 150.0, legs);
    expect(o.orderType).toBe(OrderType.LMT);
    expect(o.limitPrice).toBe(150.0);
    expect(o.orderLegs).toHaveLength(1);
    expect(o.orderLegs![0].legType).toBe('PROFIT');
  });

  it('空腿数组应抛错', () => {
    expect(() => limitOrderWithLegs('ACC', 'AAPL', 'STK', 'BUY', 100, 150.0, []))
      .toThrow('At least 1 order leg');
  });

  it('超过 2 腿应抛错', () => {
    const legs = [orderLeg('PROFIT', 200.0, 'GTC'), orderLeg('LOSS', 100.0, 'GTC'), orderLeg('LOSS', 90.0, 'GTC')];
    expect(() => limitOrderWithLegs('ACC', 'AAPL', 'STK', 'BUY', 100, 150.0, legs))
      .toThrow('At most 2');
  });
});

describe('comboOrder', () => {
  it('应构造多腿组合单，默认 comboType=MLEG', () => {
    const legs = [contractLeg('AAPL', 'OPT', 'BUY', 1, '20261218', '200', 'CALL')];
    const o = comboOrder('ACC', 'BUY', 1, 'LMT', legs, undefined, 5.0);
    expect(o.secType).toBe('MLEG');
    expect(o.contractLegs).toHaveLength(1);
    expect(o.comboType).toBe('MLEG');
    expect(o.limitPrice).toBe(5.0);
  });

  it('可自定义 comboType', () => {
    const legs = [contractLeg('TSLA', 'OPT', 'SELL', 1)];
    const o = comboOrder('ACC', 'SELL', 1, 'MKT', legs, 'CUSTOM');
    expect(o.comboType).toBe('CUSTOM');
  });
});

describe('ocaOrder', () => {
  it('应构造 OCA 单', () => {
    const sub = limitOrder('ACC', 'AAPL', 'STK', 'BUY', 100, 150.0);
    const o = ocaOrder('ACC', 'AAPL', 'STK', 'BUY', 100, [sub]);
    expect(o.orderType).toBe(OrderType.OCA);
    expect(o.ocaOrders).toHaveLength(1);
  });
});

describe('contractLeg', () => {
  it('应构造多腿期权子腿', () => {
    const leg = contractLeg('AAPL', 'OPT', 'BUY', 2, '20261218', '200', 'CALL');
    expect(leg.symbol).toBe('AAPL');
    expect(leg.secType).toBe('OPT');
    expect(leg.action).toBe('BUY');
    expect(leg.ratio).toBe(2);
    expect(leg.expiry).toBe('20261218');
    expect(leg.strike).toBe('200');
    expect(leg.right).toBe('CALL');
  });

  it('可选字段留空', () => {
    const leg = contractLeg('TSLA', 'STK', 'SELL', 1);
    expect(leg.expiry).toBeUndefined();
    expect(leg.strike).toBeUndefined();
    expect(leg.right).toBeUndefined();
  });
});
