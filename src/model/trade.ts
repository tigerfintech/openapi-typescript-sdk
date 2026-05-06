/**
 * Trade response models (Asset / PrimeAsset / order result / transaction).
 */
import type { Order } from './order';

export interface AssetSegment {
  account?: string;
  category?: string;
  title?: string;
  netLiquidation?: number;
  cashValue?: number;
  availableFunds?: number;
  equityWithLoan?: number;
  excessLiquidity?: number;
  accruedCash?: number;
  accruedDividend?: number;
  initMarginReq?: number;
  maintMarginReq?: number;
  grossPositionValue?: number;
  leverage?: number;
}

export interface Asset {
  account?: string;
  capability?: string;
  currency?: string;
  buyingPower?: number;
  cashValue?: number;
  netLiquidation?: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  segments?: AssetSegment[];
}

export interface CurrencyAsset {
  currency?: string;
  cashBalance?: number;
  cashAvailableForTrade?: number;
  forexRate?: number;
}

export interface PrimeAssetSegment {
  capability?: string;
  category?: string;
  currency?: string;
  cashBalance?: number;
  cashAvailableForTrade?: number;
  grossPositionValue?: number;
  equityWithLoan?: number;
  netLiquidation?: number;
  initMargin?: number;
  maintainMargin?: number;
  overnightMargin?: number;
  unrealizedPL?: number;
  unrealizedPLByCostOfCarry?: number;
  realizedPL?: number;
  totalTodayPL?: number;
  excessLiquidation?: number;
  overnightLiquidation?: number;
  buyingPower?: number;
  lockedFunds?: number;
  leverage?: number;
  uncollected?: number;
  currencyAssets?: CurrencyAsset[];
  consolidatedSegTypes?: string[];
}

export interface PrimeAsset {
  accountId: string;
  updateTimestamp?: number;
  segments: PrimeAssetSegment[];
}

export interface PreviewResult {
  account?: string;
  isPass: boolean;
  commission?: number;
  commissionCurrency?: string;
  marginCurrency?: string;
  initMargin?: number;
  initMarginBefore?: number;
  maintMargin?: number;
  maintMarginBefore?: number;
  equityWithLoan?: number;
  equityWithLoanBefore?: number;
  availableEE?: number;
  excessLiquidity?: number;
  overnightLiquidation?: number;
  gst?: number;
  message?: string;
}

export interface PlaceOrderResult {
  id: number;
  /** Account-level order ID; the server returns snake_case `order_id` */
  order_id?: number;
  subIds?: number[];
  orders?: Order[];
}

export interface OrderIdResult {
  id: number;
}

export interface Transaction {
  id?: number;
  orderId?: number;
  account?: string;
  symbol?: string;
  secType?: string;
  market?: string;
  currency?: string;
  identifier?: string;
  action?: string;
  price?: number;
  quantity?: number;
  filledQuantity?: number;
  amount?: number;
  commission?: number;
  transactedAt?: number;
  time?: number;
}
