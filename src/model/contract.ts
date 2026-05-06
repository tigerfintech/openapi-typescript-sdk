/**
 * Contract / TickSize models.
 */

/** Tick size tier */
export interface TickSize {
  begin?: string;
  end?: string;
  tickSize?: number;
  type?: string;
}

/** Contract model (returned by contract / contracts / quoteContract / derivative queries) */
export interface Contract {
  contractId?: number;
  symbol: string;
  secType: string;
  currency?: string;
  exchange?: string;
  primaryExchange?: string;
  localSymbol?: string;
  tradingClass?: string;
  expiry?: string;
  strike?: number;
  right?: string;
  multiplier?: number;
  identifier?: string;
  name?: string;
  market?: string;
  tradeable?: boolean;
  conid?: number;
  status?: number;
  marginable?: boolean;
  shortable?: boolean;
  closeOnly?: boolean;
  isEtf?: boolean;
  supportOvernightTrading?: boolean;
  supportFractionalShare?: boolean;
  shortMargin?: number;
  shortInitialMargin?: number;
  shortMaintenanceMargin?: number;
  longInitialMargin?: number;
  longMaintenanceMargin?: number;
  tickSizes?: TickSize[];
  lotSize?: number;
}
