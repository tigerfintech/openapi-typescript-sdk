/**
 * PushClient - TCP + TLS push client (Protobuf protocol)
 *
 * Connects to the push server via raw TCP + TLS to receive real-time
 * market data and account push notifications.
 * Uses varint32 length-prefixed + Protobuf binary frame format,
 * aligned with the Java SDK's Netty + Protobuf implementation.
 * Supports connection authentication, subscribe/unsubscribe, callbacks,
 * heartbeat keep-alive, and automatic reconnection.
 */
import * as tls from 'tls';
import type { ClientConfig } from '../config/client-config';
import { signWithRSA } from '../signer/signer';
import type { Callbacks } from './callbacks';
import { SubjectType } from './push-message';
import { Request } from './pb/Request';
import { Response } from './pb/Response';
import { SocketCommon_Command, SocketCommon_DataType } from './pb/SocketCommon';
import type { PushData } from './pb/PushData';
import { encodeVarint32, decodeVarint32 } from './varint';
import {
  buildConnectMessage,
  buildHeartBeatMessage,
  buildSubscribeMessage,
  buildUnSubscribeMessage,
  buildDisconnectMessage,
  subjectToDataType,
} from './proto-message';

/** Default push server host */
const DEFAULT_PUSH_HOST = 'openapi.tigerfintech.com';
/** Default push server port */
const DEFAULT_PUSH_PORT = 9883;
/** Default heartbeat interval (ms) */
const DEFAULT_HEARTBEAT_INTERVAL = 10_000;
/** Default reconnect interval (ms) */
const DEFAULT_RECONNECT_INTERVAL = 5_000;
/** Max reconnect interval (ms) */
const MAX_RECONNECT_INTERVAL = 60_000;
/** Default connect timeout (ms) */
const DEFAULT_CONNECT_TIMEOUT = 30_000;
/** SDK version identifier */
const SDK_VERSION = 'typescript/0.1.0';
/** Protocol version */
const ACCEPT_VERSION = '1.0';
/** Default send heartbeat interval (ms) */
const DEFAULT_SEND_INTERVAL = 10_000;
/** Default receive heartbeat interval (ms) */
const DEFAULT_RECEIVE_INTERVAL = 10_000;

/** Connection state */
export enum ConnectionState {
  Disconnected = 0,
  Connecting = 1,
  Connected = 2,
}

/** PushClient configuration options */
export interface PushClientOptions {
  pushHost?: string;
  pushPort?: number;
  heartbeatInterval?: number;
  reconnectInterval?: number;
  autoReconnect?: boolean;
  connectTimeout?: number;
  useFullTick?: boolean;
}

/**
 * TLS socket interface for test injection
 */
export interface TLSSocketLike {
  write(data: Uint8Array): boolean;
  destroy(): void;
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'connect', listener: () => void): this;
}

/** TLS socket factory function type */
export type TLSSocketFactory = (host: string, port: number) => TLSSocketLike;

/**
 * PushClient - TCP + TLS push client (Protobuf protocol)
 */
export class PushClient {
  private config: ClientConfig;
  private pushHost: string;
  private pushPort: number;
  private heartbeatInterval: number;
  private reconnectInterval: number;
  private autoReconnect: boolean;
  private connectTimeout: number;
  private useFullTick: boolean;

  private socket: TLSSocketLike | null = null;
  private _state: ConnectionState = ConnectionState.Disconnected;
  private callbacks: Callbacks = {};

  /** Subscription state: subject -> Set<symbol> */
  private subscriptions = new Map<SubjectType, Set<string>>();
  /** Account-level subscriptions */
  private accountSubs = new Set<SubjectType>();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  /** TCP stream receive buffer */
  private recvBuffer: Buffer = Buffer.alloc(0);

  /** Injectable TLS socket factory (for testing) */
  socketFactory: TLSSocketFactory | null = null;

  constructor(config: ClientConfig, options?: PushClientOptions) {
    this.config = config;
    this.pushHost = options?.pushHost ?? DEFAULT_PUSH_HOST;
    this.pushPort = options?.pushPort ?? DEFAULT_PUSH_PORT;
    this.heartbeatInterval = options?.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
    this.reconnectInterval = options?.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL;
    this.autoReconnect = options?.autoReconnect ?? true;
    this.connectTimeout = options?.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this.useFullTick = options?.useFullTick ?? false;
  }

  /** Get current connection state */
  get state(): ConnectionState {
    return this._state;
  }

  /** Set callback functions */
  setCallbacks(cb: Callbacks): void {
    this.callbacks = cb;
  }

  /** Connect to the push server and authenticate */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._state !== ConnectionState.Disconnected) {
        reject(new Error('Client is already connected or connecting'));
        return;
      }
      this._state = ConnectionState.Connecting;
      this.stopped = false;
      this.recvBuffer = Buffer.alloc(0);

      const socket = this.createSocket(this.pushHost, this.pushPort);
      this.socket = socket;

      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          this._state = ConnectionState.Disconnected;
          this.socket = null;
          reject(new Error('Connect timeout'));
        }
      }, this.connectTimeout);

      // Resolve once we receive CONNECTED response from server
      const onConnected = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this._state = ConnectionState.Connected;
          this.startHeartbeat();
          this.callbacks.onConnect?.();
          resolve();
        }
      };

      socket.on('connect', () => {
        // TLS handshake complete, send authentication message
        try {
          this.authenticate();
        } catch (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            socket.destroy();
            this._state = ConnectionState.Disconnected;
            this.socket = null;
            reject(err);
          }
        }
      });

      socket.on('data', (chunk: Buffer) => {
        this.handleData(chunk, onConnected);
      });

      socket.on('close', () => {
        if (this.stopped) return;
        this.stopHeartbeat();
        const wasConnected = this._state === ConnectionState.Connected;
        this._state = ConnectionState.Disconnected;
        this.socket = null;
        if (wasConnected && this.autoReconnect && !this.stopped) {
          this.scheduleReconnect();
        }
      });

      socket.on('error', (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this._state = ConnectionState.Disconnected;
          this.socket = null;
          reject(new Error(`TLS connection failed: ${err.message}`));
        } else {
          this.callbacks.onError?.(new Error(`TLS error: ${err.message}`));
        }
      });
    });
  }

  /** Disconnect from the push server */
  disconnect(): void {
    this.stopped = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.socket) {
      // Send DISCONNECT message before closing
      try {
        const req = buildDisconnectMessage();
        this.sendMessage(req);
      } catch {
        // Ignore send failure, continue closing
      }
      this.socket.destroy();
      this.socket = null;
    }
    this._state = ConnectionState.Disconnected;
    this.recvBuffer = Buffer.alloc(0);
    this.callbacks.onDisconnect?.();
  }

  /** Send authentication message */
  private authenticate(): void {
    // Sign content is the tigerId string itself (aligned with Java SDK)
    const sign = signWithRSA(this.config.privateKey, this.config.tigerId);
    const req = buildConnectMessage(
      this.config.tigerId,
      sign,
      SDK_VERSION,
      ACCEPT_VERSION,
      DEFAULT_SEND_INTERVAL,
      DEFAULT_RECEIVE_INTERVAL,
      this.useFullTick,
    );
    this.sendMessage(req);
  }

  /** Send a Protobuf Request message (varint32 length prefix + binary) */
  private sendMessage(msg: Request): void {
    if (!this.socket) throw new Error('TLS connection not established');
    const encoded = Request.encode(msg).finish();
    const framed = encodeVarint32(encoded);
    this.socket.write(framed);
  }

  /** Create a TLS socket instance */
  private createSocket(host: string, port: number): TLSSocketLike {
    if (this.socketFactory) return this.socketFactory(host, port);
    return tls.connect({ host, port, rejectUnauthorized: false }) as unknown as TLSSocketLike;
  }

  /** Handle incoming TCP data: buffer + decode varint32 frames */
  private handleData(chunk: Buffer, onConnected?: () => void): void {
    this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);

    while (this.recvBuffer.length > 0) {
      const frame = decodeVarint32(new Uint8Array(this.recvBuffer));
      if (!frame) break; // Incomplete frame, wait for more data

      this.recvBuffer = Buffer.from(frame.remaining);

      // Deserialize Protobuf Response
      let response: Response;
      try {
        response = Response.decode(frame.message);
      } catch {
        this.callbacks.onError?.(new Error('Protobuf deserialization failed'));
        continue;
      }

      this.handleResponse(response, onConnected);
    }
  }

  /** Handle a decoded Response message */
  private handleResponse(response: Response, onConnected?: () => void): void {
    const cb = this.callbacks;

    switch (response.command) {
      case SocketCommon_Command.CONNECTED:
        // Server confirmed authentication
        onConnected?.();
        break;

      case SocketCommon_Command.HEARTBEAT:
        // Heartbeat response, ignore
        break;

      case SocketCommon_Command.MESSAGE:
        if (response.body) {
          this.dispatchPushData(response.body);
        }
        break;

      case SocketCommon_Command.ERROR:
        cb.onError?.(new Error(`Server error: ${response.msg ?? 'unknown error'}`));
        // Check for kickout
        if (response.msg && response.msg.toLowerCase().includes('kickout')) {
          cb.onKickout?.(response.msg);
        }
        break;

      case SocketCommon_Command.DISCONNECT:
        cb.onDisconnect?.();
        break;

      default:
        break;
    }
  }

  /** Heartbeat keep-alive */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      try {
        const req = buildHeartBeatMessage();
        this.sendMessage(req);
      } catch {
        // Heartbeat send failed, connection may be broken
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Auto reconnect with exponential backoff */
  private scheduleReconnect(): void {
    let interval = this.reconnectInterval;
    const attempt = () => {
      if (this.stopped) return;
      this.connect().then(() => {
        this.resubscribe();
      }).catch(() => {
        interval = Math.min(interval * 2, MAX_RECONNECT_INTERVAL);
        if (!this.stopped) {
          this.reconnectTimer = setTimeout(attempt, interval);
        }
      });
    };
    this.reconnectTimer = setTimeout(attempt, interval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Resubscribe after reconnection */
  private resubscribe(): void {
    for (const [subject, symbols] of this.subscriptions) {
      this.doSubscribe(subject, Array.from(symbols));
    }
    for (const subject of this.accountSubs) {
      this.doSubscribe(subject, undefined, this.config.account);
    }
  }

  /** Dispatch push data to the appropriate callback based on dataType */
  private dispatchPushData(pushData: PushData): void {
    const cb = this.callbacks;

    switch (pushData.dataType) {
      case SocketCommon_DataType.Quote:
        if (pushData.quoteData) cb.onQuote?.(pushData.quoteData);
        break;
      case SocketCommon_DataType.Option:
        if (pushData.quoteData) cb.onOption?.(pushData.quoteData);
        break;
      case SocketCommon_DataType.Future:
        if (pushData.quoteData) cb.onFuture?.(pushData.quoteData);
        break;
      case SocketCommon_DataType.QuoteDepth:
        if (pushData.quoteDepthData) cb.onDepth?.(pushData.quoteDepthData);
        break;
      case SocketCommon_DataType.TradeTick:
        if (pushData.tradeTickData) cb.onTick?.(pushData.tradeTickData);
        break;
      case SocketCommon_DataType.Asset:
        if (pushData.assetData) cb.onAsset?.(pushData.assetData);
        break;
      case SocketCommon_DataType.Position:
        if (pushData.positionData) cb.onPosition?.(pushData.positionData);
        break;
      case SocketCommon_DataType.OrderStatus:
        if (pushData.orderStatusData) cb.onOrder?.(pushData.orderStatusData);
        break;
      case SocketCommon_DataType.OrderTransaction:
        if (pushData.orderTransactionData) cb.onTransaction?.(pushData.orderTransactionData);
        break;
      case SocketCommon_DataType.StockTop:
        if (pushData.stockTopData) cb.onStockTop?.(pushData.stockTopData);
        break;
      case SocketCommon_DataType.OptionTop:
        if (pushData.optionTopData) cb.onOptionTop?.(pushData.optionTopData);
        break;
      case SocketCommon_DataType.Kline:
        if (pushData.klineData) cb.onKline?.(pushData.klineData);
        break;
      default:
        // FullTick and QuoteBBO use TradeTick/Quote dataType
        // TickData (fullTick) via tickData field
        if (pushData.tickData) cb.onFullTick?.(pushData.tickData);
        break;
    }
  }

  /** Internal subscribe method */
  private doSubscribe(subject: SubjectType, symbols?: string[], account?: string, market?: string): void {
    const dataType = subjectToDataType(subject);
    const symbolsStr = symbols ? symbols.join(',') : undefined;
    const req = buildSubscribeMessage(dataType, symbolsStr, account, market);
    this.sendMessage(req);
  }

  /** Internal unsubscribe method */
  private doUnsubscribe(subject: SubjectType, symbols?: string[]): void {
    const dataType = subjectToDataType(subject);
    const symbolsStr = symbols ? symbols.join(',') : undefined;
    const req = buildUnSubscribeMessage(dataType, symbolsStr);
    this.sendMessage(req);
  }

  /** Add subscription record */
  private addSubscription(subject: SubjectType, symbols: string[]): void {
    if (!this.subscriptions.has(subject)) {
      this.subscriptions.set(subject, new Set());
    }
    const set = this.subscriptions.get(subject)!;
    for (const s of symbols) set.add(s);
  }

  /** Remove subscription record */
  private removeSubscription(subject: SubjectType, symbols?: string[]): void {
    if (!symbols) {
      this.subscriptions.delete(subject);
      return;
    }
    const set = this.subscriptions.get(subject);
    if (set) {
      for (const s of symbols) set.delete(s);
      if (set.size === 0) this.subscriptions.delete(subject);
    }
  }

  // ===== Market data subscribe/unsubscribe =====

  /** Subscribe to quotes */
  subscribeQuote(symbols: string[]): void {
    this.doSubscribe(SubjectType.Quote, symbols);
    this.addSubscription(SubjectType.Quote, symbols);
  }
  /** Unsubscribe from quotes */
  unsubscribeQuote(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Quote, symbols);
    this.removeSubscription(SubjectType.Quote, symbols);
  }

  /** Subscribe to trade ticks */
  subscribeTick(symbols: string[]): void {
    this.doSubscribe(SubjectType.Tick, symbols);
    this.addSubscription(SubjectType.Tick, symbols);
  }
  /** Unsubscribe from trade ticks */
  unsubscribeTick(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Tick, symbols);
    this.removeSubscription(SubjectType.Tick, symbols);
  }

  /** Subscribe to depth data */
  subscribeDepth(symbols: string[]): void {
    this.doSubscribe(SubjectType.Depth, symbols);
    this.addSubscription(SubjectType.Depth, symbols);
  }
  /** Unsubscribe from depth data */
  unsubscribeDepth(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Depth, symbols);
    this.removeSubscription(SubjectType.Depth, symbols);
  }

  /** Subscribe to option quotes */
  subscribeOption(symbols: string[]): void {
    this.doSubscribe(SubjectType.Option, symbols);
    this.addSubscription(SubjectType.Option, symbols);
  }
  /** Unsubscribe from option quotes */
  unsubscribeOption(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Option, symbols);
    this.removeSubscription(SubjectType.Option, symbols);
  }

  /** Subscribe to futures quotes */
  subscribeFuture(symbols: string[]): void {
    this.doSubscribe(SubjectType.Future, symbols);
    this.addSubscription(SubjectType.Future, symbols);
  }
  /** Unsubscribe from futures quotes */
  unsubscribeFuture(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Future, symbols);
    this.removeSubscription(SubjectType.Future, symbols);
  }

  /** Subscribe to kline data */
  subscribeKline(symbols: string[]): void {
    this.doSubscribe(SubjectType.Kline, symbols);
    this.addSubscription(SubjectType.Kline, symbols);
  }
  /** Unsubscribe from kline data */
  unsubscribeKline(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Kline, symbols);
    this.removeSubscription(SubjectType.Kline, symbols);
  }

  // ===== Account push subscribe/unsubscribe =====

  /** Subscribe to asset changes */
  subscribeAsset(account?: string): void {
    this.doSubscribe(SubjectType.Asset, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Asset);
  }
  /** Unsubscribe from asset changes */
  unsubscribeAsset(): void {
    this.doUnsubscribe(SubjectType.Asset);
    this.accountSubs.delete(SubjectType.Asset);
  }

  /** Subscribe to position changes */
  subscribePosition(account?: string): void {
    this.doSubscribe(SubjectType.Position, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Position);
  }
  /** Unsubscribe from position changes */
  unsubscribePosition(): void {
    this.doUnsubscribe(SubjectType.Position);
    this.accountSubs.delete(SubjectType.Position);
  }

  /** Subscribe to order status */
  subscribeOrder(account?: string): void {
    this.doSubscribe(SubjectType.Order, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Order);
  }
  /** Unsubscribe from order status */
  unsubscribeOrder(): void {
    this.doUnsubscribe(SubjectType.Order);
    this.accountSubs.delete(SubjectType.Order);
  }

  /** Subscribe to transaction details */
  subscribeTransaction(account?: string): void {
    this.doSubscribe(SubjectType.Transaction, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Transaction);
  }
  /** Unsubscribe from transaction details */
  unsubscribeTransaction(): void {
    this.doUnsubscribe(SubjectType.Transaction);
    this.accountSubs.delete(SubjectType.Transaction);
  }

  // ===== Query subscription state =====

  /** Get current market data subscriptions */
  getSubscriptions(): Map<SubjectType, string[]> {
    const result = new Map<SubjectType, string[]>();
    for (const [subject, symbols] of this.subscriptions) {
      result.set(subject, Array.from(symbols));
    }
    return result;
  }

  /** Get account-level subscriptions */
  getAccountSubscriptions(): SubjectType[] {
    return Array.from(this.accountSubs);
  }
}
