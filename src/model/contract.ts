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

/** A supported combination of order type, time in force, and trading session. */
export interface OrderCapability {
  orderType?: string | null;
  timeInForce?: string | null;
  tradingSessionType?: string | null;
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
  /** Absent or null when the server provides no special capabilities. */
  orderCapabilities?: OrderCapability[] | null;
  shortMargin?: number;
  shortInitialMargin?: number;
  shortMaintenanceMargin?: number;
  longInitialMargin?: number;
  longMaintenanceMargin?: number;
  tickSizes?: TickSize[];
  lotSize?: number;
}
