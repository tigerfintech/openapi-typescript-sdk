/**
 * 合约构造工具函数
 */
import type { Contract } from './contract';
import { SecurityType } from './enums';

/** 构造股票合约 */
export function stockContract(symbol: string, currency: string): Contract {
  return { symbol, secType: SecurityType.STK, currency };
}

/** 通过 identifier 构造期权合约 */
export function optionContract(identifier: string): Contract {
  return { symbol: '', secType: SecurityType.OPT, identifier };
}

/** 通过各字段构造期权合约 */
export function optionContractBySymbol(
  symbol: string,
  expiry: string,
  strike: number,
  right: string,
  currency: string,
): Contract {
  return { symbol, secType: SecurityType.OPT, expiry, strike, right, currency };
}

/** 构造期货合约 */
export function futureContract(symbol: string, currency: string, expiry: string): Contract {
  return { symbol, secType: SecurityType.FUT, currency, expiry };
}

/** 构造外汇合约 */
export function cashContract(symbol: string): Contract {
  return { symbol, secType: SecurityType.CASH };
}

/** 构造基金合约 */
export function fundContract(symbol: string, currency: string): Contract {
  return { symbol, secType: SecurityType.FUND, currency };
}

/** 构造窝轮合约 */
export function warrantContract(
  symbol: string,
  currency: string,
  expiry: string,
  strike: number,
  right: string,
): Contract {
  return { symbol, secType: SecurityType.WAR, currency, expiry, strike, right };
}
