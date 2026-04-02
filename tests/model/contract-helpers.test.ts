/**
 * 合约构造工具函数测试
 */
import { describe, it, expect } from 'vitest';
import {
  stockContract,
  optionContract,
  optionContractBySymbol,
  futureContract,
  cashContract,
  fundContract,
  warrantContract,
} from '../../src/model/contract-helpers';
import { SecurityType } from '../../src/model/enums';

describe('stockContract', () => {
  it('应构造股票合约', () => {
    const c = stockContract('AAPL', 'USD');
    expect(c.symbol).toBe('AAPL');
    expect(c.secType).toBe(SecurityType.STK);
    expect(c.currency).toBe('USD');
  });

  it('不同市场的股票合约', () => {
    const c = stockContract('00700', 'HKD');
    expect(c.symbol).toBe('00700');
    expect(c.secType).toBe('STK');
    expect(c.currency).toBe('HKD');
  });
});

describe('optionContract', () => {
  it('应通过 identifier 构造期权合约', () => {
    const c = optionContract('AAPL 250620C00150000');
    expect(c.secType).toBe(SecurityType.OPT);
    expect(c.identifier).toBe('AAPL 250620C00150000');
  });
});

describe('optionContractBySymbol', () => {
  it('应通过各字段构造期权合约', () => {
    const c = optionContractBySymbol('AAPL', '20250620', 150.0, 'CALL', 'USD');
    expect(c.symbol).toBe('AAPL');
    expect(c.secType).toBe(SecurityType.OPT);
    expect(c.expiry).toBe('20250620');
    expect(c.strike).toBe(150.0);
    expect(c.right).toBe('CALL');
    expect(c.currency).toBe('USD');
  });
});

describe('futureContract', () => {
  it('应构造期货合约', () => {
    const c = futureContract('ES', 'USD', '20250620');
    expect(c.symbol).toBe('ES');
    expect(c.secType).toBe(SecurityType.FUT);
    expect(c.currency).toBe('USD');
    expect(c.expiry).toBe('20250620');
  });
});

describe('cashContract', () => {
  it('应构造外汇合约', () => {
    const c = cashContract('EUR.USD');
    expect(c.symbol).toBe('EUR.USD');
    expect(c.secType).toBe(SecurityType.CASH);
  });
});

describe('fundContract', () => {
  it('应构造基金合约', () => {
    const c = fundContract('SPY', 'USD');
    expect(c.symbol).toBe('SPY');
    expect(c.secType).toBe(SecurityType.FUND);
    expect(c.currency).toBe('USD');
  });
});

describe('warrantContract', () => {
  it('应构造窝轮合约', () => {
    const c = warrantContract('00700', 'HKD', '20250620', 400.0, 'CALL');
    expect(c.symbol).toBe('00700');
    expect(c.secType).toBe(SecurityType.WAR);
    expect(c.currency).toBe('HKD');
    expect(c.expiry).toBe('20250620');
    expect(c.strike).toBe(400.0);
    expect(c.right).toBe('CALL');
  });
});
