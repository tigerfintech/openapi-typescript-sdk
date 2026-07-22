/**
 * Order construction helpers.
 * All helpers return an `OrderRequest` with sensible defaults.
 */
import type { OrderRequest, OrderLegRequest, AlgoParamsRequest } from './order';
import { OrderType, TimeInForce, PriceType } from './enums';

/** Market order */
export function marketOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.MKT,
    totalQuantity: quantity,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** Limit order */
export function limitOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.LMT,
    totalQuantity: quantity,
    limitPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** Stop order */
export function stopOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  auxPrice: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.STP,
    totalQuantity: quantity,
    auxPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** Stop limit order */
export function stopLimitOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
  auxPrice: number,
): OrderRequest {
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

/** Trailing stop order */
export function trailOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  trailingPercent: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.TRAIL,
    totalQuantity: quantity,
    trailingPercent,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** Auction limit order */
export function auctionLimitOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.AL,
    totalQuantity: quantity,
    limitPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** Auction market order */
export function auctionMarketOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.AM,
    totalQuantity: quantity,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/** Algo order (TWAP / VWAP) */
export function algoOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
  algoType: string,
  params: AlgoParamsRequest,
): OrderRequest {
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

/**
 * Iceberg order (basic) — only displaySize required.
 */
export function icebergOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
  displaySize: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.ICEBERG,
    totalQuantity: quantity,
    limitPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
    displaySize,
    priceType: PriceType.LIMIT_PRICE,
  };
}

/**
 * Iceberg order (full params).
 * Pass `priceType` as empty string to use server default (LIMIT_PRICE).
 * Pass `startTime` / `endTime` as 0 to omit the time window.
 */
export function icebergOrderFull(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
  displaySize: number,
  minDisplaySize?: number,
  checkIntervals?: number,
  priceType?: PriceType | string,
  startTime?: number,
  endTime?: number,
): OrderRequest {
  const req: OrderRequest = {
    account, symbol, secType, action,
    orderType: OrderType.ICEBERG,
    totalQuantity: quantity,
    limitPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
    displaySize,
  };
  if (minDisplaySize !== undefined && minDisplaySize > 0) req.minDisplaySize = minDisplaySize;
  if (checkIntervals !== undefined && checkIntervals > 0) req.checkIntervals = checkIntervals;
  if (priceType) req.priceType = priceType;
  if (startTime && startTime > 0) req.startTime = startTime;
  if (endTime && endTime > 0) req.endTime = endTime;
  return req;
}

/** Attached profit / loss leg */
export function orderLeg(
  legType: string,
  price: number,
  timeInForce: string,
): OrderLegRequest {
  return { legType, price, timeInForce };
}
