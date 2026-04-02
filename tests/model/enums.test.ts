/**
 * 枚举类型测试
 * 验证所有枚举类型的值与 API JSON 一致
 */
import { describe, it, expect } from 'vitest';
import {
  Market,
  SecurityType,
  Currency,
  OrderType,
  OrderStatus,
  BarPeriod,
  Language,
  QuoteRight,
  License,
  TimeInForce,
} from '../../src/model/enums';

describe('Market 枚举', () => {
  it('应包含所有市场值', () => {
    expect(Market.All).toBe('ALL');
    expect(Market.US).toBe('US');
    expect(Market.HK).toBe('HK');
    expect(Market.CN).toBe('CN');
    expect(Market.SG).toBe('SG');
  });
});

describe('SecurityType 枚举', () => {
  it('应包含所有证券类型值', () => {
    expect(SecurityType.All).toBe('ALL');
    expect(SecurityType.STK).toBe('STK');
    expect(SecurityType.OPT).toBe('OPT');
    expect(SecurityType.WAR).toBe('WAR');
    expect(SecurityType.IOPT).toBe('IOPT');
    expect(SecurityType.FUT).toBe('FUT');
    expect(SecurityType.FOP).toBe('FOP');
    expect(SecurityType.CASH).toBe('CASH');
    expect(SecurityType.MLEG).toBe('MLEG');
    expect(SecurityType.FUND).toBe('FUND');
  });
});

describe('Currency 枚举', () => {
  it('应包含所有货币值', () => {
    expect(Currency.All).toBe('ALL');
    expect(Currency.USD).toBe('USD');
    expect(Currency.HKD).toBe('HKD');
    expect(Currency.CNH).toBe('CNH');
    expect(Currency.SGD).toBe('SGD');
  });
});

describe('OrderType 枚举', () => {
  it('应包含所有订单类型值', () => {
    expect(OrderType.MKT).toBe('MKT');
    expect(OrderType.LMT).toBe('LMT');
    expect(OrderType.STP).toBe('STP');
    expect(OrderType.STP_LMT).toBe('STP_LMT');
    expect(OrderType.TRAIL).toBe('TRAIL');
    expect(OrderType.AM).toBe('AM');
    expect(OrderType.AL).toBe('AL');
    expect(OrderType.TWAP).toBe('TWAP');
    expect(OrderType.VWAP).toBe('VWAP');
    expect(OrderType.OCA).toBe('OCA');
  });
});

describe('OrderStatus 枚举', () => {
  it('应包含所有订单状态值', () => {
    expect(OrderStatus.PendingNew).toBe('PendingNew');
    expect(OrderStatus.Initial).toBe('Initial');
    expect(OrderStatus.Submitted).toBe('Submitted');
    expect(OrderStatus.PartiallyFilled).toBe('PartiallyFilled');
    expect(OrderStatus.Filled).toBe('Filled');
    expect(OrderStatus.Cancelled).toBe('Cancelled');
    expect(OrderStatus.PendingCancel).toBe('PendingCancel');
    expect(OrderStatus.Inactive).toBe('Inactive');
    expect(OrderStatus.Invalid).toBe('Invalid');
  });
});

describe('BarPeriod 枚举', () => {
  it('应包含所有 K 线周期值', () => {
    expect(BarPeriod.Day).toBe('day');
    expect(BarPeriod.Week).toBe('week');
    expect(BarPeriod.Month).toBe('month');
    expect(BarPeriod.Year).toBe('year');
    expect(BarPeriod.Min1).toBe('1min');
    expect(BarPeriod.Min5).toBe('5min');
    expect(BarPeriod.Min15).toBe('15min');
    expect(BarPeriod.Min30).toBe('30min');
    expect(BarPeriod.Min60).toBe('60min');
  });
});

describe('Language 枚举', () => {
  it('应包含所有语言值', () => {
    expect(Language.ZhCN).toBe('zh_CN');
    expect(Language.ZhTW).toBe('zh_TW');
    expect(Language.EnUS).toBe('en_US');
  });
});

describe('QuoteRight 枚举', () => {
  it('应包含所有复权类型值', () => {
    expect(QuoteRight.Br).toBe('br');
    expect(QuoteRight.Nr).toBe('nr');
  });
});

describe('License 枚举', () => {
  it('应包含所有牌照类型值', () => {
    expect(License.TBNZ).toBe('TBNZ');
    expect(License.TBSG).toBe('TBSG');
    expect(License.TBHK).toBe('TBHK');
    expect(License.TBAU).toBe('TBAU');
    expect(License.TBUS).toBe('TBUS');
  });
});

describe('TimeInForce 枚举', () => {
  it('应包含所有订单有效期值', () => {
    expect(TimeInForce.DAY).toBe('DAY');
    expect(TimeInForce.GTC).toBe('GTC');
    expect(TimeInForce.OPG).toBe('OPG');
  });
});
