/**
 * Order construction helpers.
 * All helpers return an `OrderRequest` with sensible defaults.
 */
import type { OrderRequest, OrderLegRequest, AlgoParamsRequest, ContractLegRequest } from './order';
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
 * Iceberg order. `displaySize` is required; all other parameters are optional.
 * Pass `priceType` as empty string to use the server default (LIMIT_PRICE).
 * Pass `startTime` / `endTime` as 0 to omit the time window.
 */
export function icebergOrder(
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
    priceType: priceType || PriceType.LIMIT_PRICE,
  };
  if (minDisplaySize !== undefined && minDisplaySize > 0) req.minDisplaySize = minDisplaySize;
  if (checkIntervals !== undefined && checkIntervals > 0) req.checkIntervals = checkIntervals;
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

/**
 * Market order by cash amount (instead of quantity).
 * Server uses `isQuantityByAmount=true` + `amount` field.
 */
export function marketOrderByAmount(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  amount: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.MKT,
    totalQuantity: 0,
    cashAmount: amount,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/**
 * Limit order by cash amount (instead of quantity).
 */
export function limitOrderByAmount(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  amount: number,
  limitPrice: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.LMT,
    totalQuantity: 0,
    cashAmount: amount,
    limitPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/**
 * Trailing stop order using a fixed price offset (auxPrice) instead of a percentage.
 * Use `trailOrder()` for percentage-based trailing stops.
 */
export function trailOrderByPrice(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  auxPrice: number,
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.TRAIL,
    totalQuantity: quantity,
    auxPrice,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/**
 * Limit order with attached profit/loss legs (bracket order).
 * At most 2 legs are supported.
 *
 * @param orderLegs - Array of `OrderLegRequest` (use `orderLeg()` helper)
 */
export function limitOrderWithLegs(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  limitPrice: number,
  orderLegs: OrderLegRequest[],
): OrderRequest {
  if (orderLegs.length === 0) {
    throw new Error('At least 1 order leg is required for a bracket order');
  }
  if (orderLegs.length > 2) {
    throw new Error('At most 2 order legs are supported');
  }
  return {
    account, symbol, secType, action,
    orderType: OrderType.LMT,
    totalQuantity: quantity,
    limitPrice,
    orderLegs,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/**
 * Multi-leg (combo/MLEG) order for options combos.
 *
 * @param contractLegs - Array of `ContractLegRequest` (use `contractLeg()` helper)
 * @param comboType - e.g. `'MLEG'`
 */
export function comboOrder(
  account: string,
  action: string,
  quantity: number,
  orderType: string,
  contractLegs: ContractLegRequest[],
  comboType: string = 'MLEG',
  limitPrice?: number,
  auxPrice?: number,
  trailingPercent?: number,
): OrderRequest {
  return {
    account,
    symbol: '',          // not used for combo orders
    secType: 'MLEG',
    action,
    orderType,
    totalQuantity: quantity,
    limitPrice,
    auxPrice,
    trailingPercent,
    contractLegs,
    comboType,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/**
 * OCA (One-Cancels-All) order.
 * Server expects `orderType: 'OCA'` and an `ocaOrders` list.
 *
 * @param ocaOrders - The contained orders (use any order helper to build each)
 */
export function ocaOrder(
  account: string,
  symbol: string,
  secType: string,
  action: string,
  quantity: number,
  ocaOrders: OrderRequest[],
): OrderRequest {
  return {
    account, symbol, secType, action,
    orderType: OrderType.OCA,
    totalQuantity: quantity,
    ocaOrders,
    timeInForce: TimeInForce.DAY,
    outsideRth: false,
  };
}

/**
 * Build a single leg for a multi-leg (MLEG / combo) order.
 *
 * @param symbol   - Underlying symbol
 * @param secType  - Security type (e.g. `'OPT'`)
 * @param action   - `'BUY'` or `'SELL'`
 * @param ratio    - Number of contracts for this leg
 */
export function contractLeg(
  symbol: string,
  secType: string,
  action: string,
  ratio: number,
  expiry?: string,
  strike?: string,
  right?: string,
): ContractLegRequest {
  return { symbol, secType, action, ratio, expiry, strike, right };
}
