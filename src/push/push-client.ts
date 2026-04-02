/**
 * PushClient - WebSocket 推送客户端
 *
 * 通过 WebSocket 长连接接收实时行情和账户推送。
 * 支持连接认证、订阅/退订、回调机制、心跳保活和自动重连。
 */
import type { ClientConfig } from '../config/client-config';
import { signWithRSA } from '../signer/signer';
import type { Callbacks } from './callbacks';
import {
  MessageType, SubjectType,
  type PushMessage, type ConnectRequest, type SubscribeRequest,
  type QuoteData, type TickData, type DepthData, type KlineData,
  type AssetData, type PositionData, type OrderData, type TransactionData,
  createPushMessage, serializeMessage, deserializeMessage,
} from './push-message';

/** 默认推送服务器地址 */
const DEFAULT_PUSH_URL = 'wss://openapi-push.tigerfintech.com';
/** 默认心跳间隔（毫秒） */
const DEFAULT_HEARTBEAT_INTERVAL = 10_000;
/** 默认重连间隔（毫秒） */
const DEFAULT_RECONNECT_INTERVAL = 5_000;
/** 最大重连间隔（毫秒） */
const MAX_RECONNECT_INTERVAL = 60_000;
/** 默认连接超时（毫秒） */
const DEFAULT_CONNECT_TIMEOUT = 30_000;

/** 连接状态 */
export enum ConnectionState {
  Disconnected = 0,
  Connecting = 1,
  Connected = 2,
}

/** PushClient 配置选项 */
export interface PushClientOptions {
  pushUrl?: string;
  heartbeatInterval?: number;
  reconnectInterval?: number;
  autoReconnect?: boolean;
  connectTimeout?: number;
}

/**
 * WebSocket 接口，方便测试注入
 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

/** WebSocket 工厂函数类型 */
export type WebSocketFactory = (url: string) => WebSocketLike;

/**
 * PushClient WebSocket 推送客户端
 */
export class PushClient {
  private config: ClientConfig;
  private pushUrl: string;
  private heartbeatInterval: number;
  private reconnectInterval: number;
  private autoReconnect: boolean;
  private connectTimeout: number;

  private ws: WebSocketLike | null = null;
  private _state: ConnectionState = ConnectionState.Disconnected;
  private callbacks: Callbacks = {};

  /** 订阅状态管理：subject -> Set<symbol> */
  private subscriptions = new Map<SubjectType, Set<string>>();
  /** 账户级别订阅 */
  private accountSubs = new Set<SubjectType>();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  /** 可注入的 WebSocket 工厂（用于测试） */
  wsFactory: WebSocketFactory | null = null;

  constructor(config: ClientConfig, options?: PushClientOptions) {
    this.config = config;
    this.pushUrl = options?.pushUrl ?? DEFAULT_PUSH_URL;
    this.heartbeatInterval = options?.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
    this.reconnectInterval = options?.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL;
    this.autoReconnect = options?.autoReconnect ?? true;
    this.connectTimeout = options?.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
  }

  /** 获取当前连接状态 */
  get state(): ConnectionState {
    return this._state;
  }

  /** 设置回调函数集合 */
  setCallbacks(cb: Callbacks): void {
    this.callbacks = cb;
  }

  /** 连接到推送服务器并进行认证 */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._state !== ConnectionState.Disconnected) {
        reject(new Error('客户端已连接或正在连接中'));
        return;
      }
      this._state = ConnectionState.Connecting;
      this.stopped = false;

      const ws = this.createWebSocket(this.pushUrl);
      this.ws = ws;

      const timeout = setTimeout(() => {
        ws.close();
        this._state = ConnectionState.Disconnected;
        this.ws = null;
        reject(new Error('连接超时'));
      }, this.connectTimeout);

      ws.onopen = () => {
        clearTimeout(timeout);
        // 发送认证消息
        try {
          this.authenticate();
          this._state = ConnectionState.Connected;
          this.startHeartbeat();
          this.callbacks.onConnect?.();
          resolve();
        } catch (err) {
          ws.close();
          this._state = ConnectionState.Disconnected;
          this.ws = null;
          reject(err);
        }
      };

      ws.onmessage = (ev: { data: unknown }) => {
        this.handleMessage(String(ev.data));
      };

      ws.onclose = () => {
        if (this.stopped) return;
        this.stopHeartbeat();
        const wasConnected = this._state === ConnectionState.Connected;
        this._state = ConnectionState.Disconnected;
        this.ws = null;
        if (wasConnected && this.autoReconnect && !this.stopped) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = (ev: unknown) => {
        if (this._state === ConnectionState.Connecting) {
          clearTimeout(timeout);
          this._state = ConnectionState.Disconnected;
          this.ws = null;
          reject(new Error('WebSocket 连接失败'));
        } else {
          this.callbacks.onError?.(new Error('WebSocket 错误'));
        }
      };
    });
  }

  /** 断开连接 */
  disconnect(): void {
    this.stopped = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this._state = ConnectionState.Disconnected;
    this.callbacks.onDisconnect?.();
  }

  /** 发送认证消息 */
  private authenticate(): void {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sign = signWithRSA(this.config.privateKey, this.config.tigerId);
    const req: ConnectRequest = {
      tigerId: this.config.tigerId,
      sign,
      timestamp: ts,
      version: '2.0',
    };
    const msg = createPushMessage(MessageType.Connect, undefined, req);
    this.sendMessage(msg);
  }

  /** 发送消息 */
  private sendMessage(msg: PushMessage): void {
    if (!this.ws) throw new Error('WebSocket 连接未建立');
    this.ws.send(serializeMessage(msg));
  }

  /** 创建 WebSocket 实例 */
  private createWebSocket(url: string): WebSocketLike {
    if (this.wsFactory) return this.wsFactory(url);
    // 动态导入 ws 库（Node.js 环境）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WS = require('ws');
    return new WS(url) as WebSocketLike;
  }

  /** 心跳保活 */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      try {
        const msg = createPushMessage(MessageType.Heartbeat);
        this.sendMessage(msg);
      } catch {
        // 心跳发送失败，连接可能已断开
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** 自动重连 */
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

  /** 重连后恢复订阅 */
  private resubscribe(): void {
    for (const [subject, symbols] of this.subscriptions) {
      this.doSubscribe(subject, Array.from(symbols));
    }
    for (const subject of this.accountSubs) {
      this.doSubscribe(subject, undefined, this.config.account);
    }
  }

  /** 处理收到的消息 */
  private handleMessage(raw: string): void {
    let msg: PushMessage;
    try {
      msg = deserializeMessage(raw);
    } catch {
      this.callbacks.onError?.(new Error('反序列化消息失败'));
      return;
    }
    const cb = this.callbacks;
    switch (msg.type) {
      case MessageType.Kickout:
        cb.onKickout?.(msg.data as string);
        break;
      case MessageType.Error:
        cb.onError?.(new Error(`服务端错误: ${msg.data}`));
        break;
      case MessageType.Quote:
        cb.onQuote?.(msg.data as QuoteData);
        break;
      case MessageType.Tick:
        cb.onTick?.(msg.data as TickData);
        break;
      case MessageType.Depth:
        cb.onDepth?.(msg.data as DepthData);
        break;
      case MessageType.Option:
        cb.onOption?.(msg.data as QuoteData);
        break;
      case MessageType.Future:
        cb.onFuture?.(msg.data as QuoteData);
        break;
      case MessageType.Kline:
        cb.onKline?.(msg.data as KlineData);
        break;
      case MessageType.Asset:
        cb.onAsset?.(msg.data as AssetData);
        break;
      case MessageType.Position:
        cb.onPosition?.(msg.data as PositionData);
        break;
      case MessageType.Order:
        cb.onOrder?.(msg.data as OrderData);
        break;
      case MessageType.Transaction:
        cb.onTransaction?.(msg.data as TransactionData);
        break;
      case MessageType.StockTop:
        cb.onStockTop?.(msg.data as QuoteData);
        break;
      case MessageType.OptionTop:
        cb.onOptionTop?.(msg.data as QuoteData);
        break;
      case MessageType.FullTick:
        cb.onFullTick?.(msg.data as TickData);
        break;
      case MessageType.QuoteBBO:
        cb.onQuoteBBO?.(msg.data as QuoteData);
        break;
    }
  }

  /** 内部订阅方法 */
  private doSubscribe(subject: SubjectType, symbols?: string[], account?: string, market?: string): void {
    const req: SubscribeRequest = { subject, symbols, account, market };
    const msg = createPushMessage(MessageType.Subscribe, subject, req);
    this.sendMessage(msg);
  }

  /** 内部退订方法 */
  private doUnsubscribe(subject: SubjectType, symbols?: string[]): void {
    const req: SubscribeRequest = { subject, symbols };
    const msg = createPushMessage(MessageType.Unsubscribe, subject, req);
    this.sendMessage(msg);
  }

  /** 添加订阅记录 */
  private addSubscription(subject: SubjectType, symbols: string[]): void {
    if (!this.subscriptions.has(subject)) {
      this.subscriptions.set(subject, new Set());
    }
    const set = this.subscriptions.get(subject)!;
    for (const s of symbols) set.add(s);
  }

  /** 移除订阅记录 */
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

  // ===== 行情订阅/退订 =====

  /** 订阅行情 */
  subscribeQuote(symbols: string[]): void {
    this.doSubscribe(SubjectType.Quote, symbols);
    this.addSubscription(SubjectType.Quote, symbols);
  }
  /** 退订行情 */
  unsubscribeQuote(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Quote, symbols);
    this.removeSubscription(SubjectType.Quote, symbols);
  }

  /** 订阅逐笔成交 */
  subscribeTick(symbols: string[]): void {
    this.doSubscribe(SubjectType.Tick, symbols);
    this.addSubscription(SubjectType.Tick, symbols);
  }
  /** 退订逐笔成交 */
  unsubscribeTick(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Tick, symbols);
    this.removeSubscription(SubjectType.Tick, symbols);
  }

  /** 订阅深度行情 */
  subscribeDepth(symbols: string[]): void {
    this.doSubscribe(SubjectType.Depth, symbols);
    this.addSubscription(SubjectType.Depth, symbols);
  }
  /** 退订深度行情 */
  unsubscribeDepth(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Depth, symbols);
    this.removeSubscription(SubjectType.Depth, symbols);
  }

  /** 订阅期权行情 */
  subscribeOption(symbols: string[]): void {
    this.doSubscribe(SubjectType.Option, symbols);
    this.addSubscription(SubjectType.Option, symbols);
  }
  /** 退订期权行情 */
  unsubscribeOption(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Option, symbols);
    this.removeSubscription(SubjectType.Option, symbols);
  }

  /** 订阅期货行情 */
  subscribeFuture(symbols: string[]): void {
    this.doSubscribe(SubjectType.Future, symbols);
    this.addSubscription(SubjectType.Future, symbols);
  }
  /** 退订期货行情 */
  unsubscribeFuture(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Future, symbols);
    this.removeSubscription(SubjectType.Future, symbols);
  }

  /** 订阅 K 线 */
  subscribeKline(symbols: string[]): void {
    this.doSubscribe(SubjectType.Kline, symbols);
    this.addSubscription(SubjectType.Kline, symbols);
  }
  /** 退订 K 线 */
  unsubscribeKline(symbols?: string[]): void {
    this.doUnsubscribe(SubjectType.Kline, symbols);
    this.removeSubscription(SubjectType.Kline, symbols);
  }

  // ===== 账户推送订阅/退订 =====

  /** 订阅资产变动 */
  subscribeAsset(account?: string): void {
    this.doSubscribe(SubjectType.Asset, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Asset);
  }
  /** 退订资产变动 */
  unsubscribeAsset(): void {
    this.doUnsubscribe(SubjectType.Asset);
    this.accountSubs.delete(SubjectType.Asset);
  }

  /** 订阅持仓变动 */
  subscribePosition(account?: string): void {
    this.doSubscribe(SubjectType.Position, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Position);
  }
  /** 退订持仓变动 */
  unsubscribePosition(): void {
    this.doUnsubscribe(SubjectType.Position);
    this.accountSubs.delete(SubjectType.Position);
  }

  /** 订阅订单状态 */
  subscribeOrder(account?: string): void {
    this.doSubscribe(SubjectType.Order, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Order);
  }
  /** 退订订单状态 */
  unsubscribeOrder(): void {
    this.doUnsubscribe(SubjectType.Order);
    this.accountSubs.delete(SubjectType.Order);
  }

  /** 订阅成交明细 */
  subscribeTransaction(account?: string): void {
    this.doSubscribe(SubjectType.Transaction, undefined, account || this.config.account);
    this.accountSubs.add(SubjectType.Transaction);
  }
  /** 退订成交明细 */
  unsubscribeTransaction(): void {
    this.doUnsubscribe(SubjectType.Transaction);
    this.accountSubs.delete(SubjectType.Transaction);
  }

  // ===== 查询订阅状态 =====

  /** 获取当前行情订阅状态 */
  getSubscriptions(): Map<SubjectType, string[]> {
    const result = new Map<SubjectType, string[]>();
    for (const [subject, symbols] of this.subscriptions) {
      result.set(subject, Array.from(symbols));
    }
    return result;
  }

  /** 获取账户级别订阅状态 */
  getAccountSubscriptions(): SubjectType[] {
    return Array.from(this.accountSubs);
  }
}
