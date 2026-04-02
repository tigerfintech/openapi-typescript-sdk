/**
 * 订单构造工具函数
 */
import type { Order, OrderLeg, AlgoParams } from './order';
import { OrderType, TimeInForce } from './enums';

/** 构造市价单 */
export function marketOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
): Order {
  return {
    account, symbol, secType, action,
    orderType: OrderType.MKT,
    totalQuantity: quantity,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造限价单 */
export function limitOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
): Order {
  return {
    account, symbol, secType, action,
    orderType: OrderType.LMT,
    totalQuantity: quantity,
    limitPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造止损单 */
export function stopOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  auxPrice: number,
): Order {
  return {
    account, symbol, secType, action,
    orderType: OrderType.STP,
    totalQuantity: quantity,
    auxPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造止损限价单 */
export function stopLimitOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
  auxPrice: number,
): Order {
  return {
    account, symbol, secType, action,
    orderType: OrderType.STP_LMT,
    totalQuantity: quantity,
    limitPrice,
    auxPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造跟踪止损单 */
export function trailOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  trailingPercent: number,
): Order {
  return {
    account, symbol, secType, action,
    orderType: OrderType.TRAIL,
    totalQuantity: quantity,
    trailingPercent,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造竞价限价单 */
export function auctionLimitOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
): Order {
  return {
    account, symbol, secType, action,
    orderType: OrderType.AL,
    totalQuantity: quantity,
    limitPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造竞价市价单 */
export function auctionMarketOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
): Order {
  return {
    account, symbol, secType, action,
    orderType: OrderType.AM,
    totalQuantity: quantity,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造算法订单（TWAP/VWAP） */
export function algoOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
  algoType: string,
  params: AlgoParams,
): Order {
  return {
    account, symbol, secType, action,
    orderType: algoType,
    totalQuantity: quantity,
    limitPrice,
    algoParams: params,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** 构造附加订单（止盈/止损） */
export function orderLeg(
  legType: string,
  price: number,
  timeInForce: string,
): OrderLeg {
  return { legType, price, timeInForce };
}
