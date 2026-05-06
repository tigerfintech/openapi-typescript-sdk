/**
 * Position model.
 */

/** Position (returned by positions query) */
export interface Position {
  account?: string;
  symbol?: string;
  secType?: string;
  market?: string;
  currency?: string;
  position?: number;
  positionScale?: number;
  positionQty?: number;
  salableQty?: number;
  averageCost?: number;
  averageCostByAverage?: number;
  averageCostOfCarry?: number;
  marketValue?: number;
  realizedPnl?: number;
  realizedPnlByAverage?: number;
  unrealizedPnl?: number;
  unrealizedPnlByAverage?: number;
  unrealizedPnlByCostOfCarry?: number;
  unrealizedPnlPercent?: number;
  unrealizedPnlPercentByAverage?: number;
  unrealizedPnlPercentByCostOfCarry?: number;
  contractId?: number;
  identifier?: string;
  name?: string;
  latestPrice?: number;
  lastClosePrice?: number;
  multiplier?: number;
  status?: number;
  updateTimestamp?: number;
  mmPercent?: number;
  mmValue?: number;
  todayPnl?: number;
  todayPnlPercent?: number;
  comboTypes?: string[];
  categories?: string[];
}
