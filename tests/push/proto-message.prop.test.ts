/**
 * Proto message builder property-based tests (fast-check)
 *
 * Feature: protobuf-push-migration
 *
 * Property 4: Request ID strictly incrementing
 * Property 5: Subscribe/Unsubscribe message completeness
 * Property 6: Connect message completeness
 * Property 7: PushData dispatch correctness
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  buildConnectMessage,
  buildHeartBeatMessage,
  buildSubscribeMessage,
  buildUnSubscribeMessage,
  buildDisconnectMessage,
} from '../../src/push/proto-message';
import { SocketCommon_Command, SocketCommon_DataType } from '../../src/push/pb/SocketCommon';
import { Response } from '../../src/push/pb/Response';
import { PushData } from '../../src/push/pb/PushData';
import { QuoteData } from '../../src/push/pb/QuoteData';
import { QuoteDepthData } from '../../src/push/pb/QuoteDepthData';
import { TradeTickData } from '../../src/push/pb/TradeTickData';
import { AssetData } from '../../src/push/pb/AssetData';
import { PositionData } from '../../src/push/pb/PositionData';
import { OrderStatusData } from '../../src/push/pb/OrderStatusData';
import { OrderTransactionData } from '../../src/push/pb/OrderTransactionData';
import { StockTopData } from '../../src/push/pb/StockTopData';
import { OptionTopData } from '../../src/push/pb/OptionTopData';
import { KlineData } from '../../src/push/pb/KlineData';
import { encodeVarint32 } from '../../src/push/varint';
import { PushClient } from '../../src/push/push-client';
import type { TLSSocketLike } from '../../src/push/push-client';
import type { ClientConfig } from '../../src/config/client-config';

// Mock signWithRSA to avoid needing a real private key
vi.mock('../../src/signer/signer', () => ({
  signWithRSA: vi.fn().mockReturnValue('mock_signature'),
  loadPrivateKey: vi.fn(),
}));

/** Generator for valid SocketCommon_DataType values (excluding Unknown/UNRECOGNIZED) */
const arbDataType = fc.constantFrom(
  SocketCommon_DataType.Quote,
  SocketCommon_DataType.Option,
  SocketCommon_DataType.Future,
  SocketCommon_DataType.QuoteDepth,
  SocketCommon_DataType.TradeTick,
  SocketCommon_DataType.Asset,
  SocketCommon_DataType.Position,
  SocketCommon_DataType.OrderStatus,
  SocketCommon_DataType.OrderTransaction,
  SocketCommon_DataType.StockTop,
  SocketCommon_DataType.OptionTop,
  SocketCommon_DataType.Kline,
);

/**
 * Property 4: Request ID strictly incrementing
 *
 * Build N consecutive messages, each ID > previous.
 *
 * **Validates: Requirements 3.4**
 */
describe('Property 4: Request ID strictly incrementing', () => {
  it('should produce strictly incrementing IDs across consecutive messages', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        (n) => {
          const ids: number[] = [];
          for (let i = 0; i < n; i++) {
            const msg = buildHeartBeatMessage();
            ids.push(msg.id);
          }

          for (let i = 1; i < ids.length; i++) {
            expect(ids[i]).toBeGreaterThan(ids[i - 1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 5: Subscribe/Unsubscribe message completeness
 *
 * For any valid dataType, symbols, account, market — buildSubscribeMessage
 * and buildUnSubscribeMessage fields match input.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 11.3, 11.4**
 */
describe('Property 5: Subscribe/Unsubscribe message completeness', () => {
  it('buildSubscribeMessage fields should match input', () => {
    fc.assert(
      fc.property(
        arbDataType,
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        (dataType, symbols, account, market) => {
          const msg = buildSubscribeMessage(dataType, symbols, account, market);

          expect(msg.command).toBe(SocketCommon_Command.SUBSCRIBE);
          expect(msg.id).toBeGreaterThan(0);
          expect(msg.subscribe).toBeDefined();
          expect(msg.subscribe!.dataType).toBe(dataType);
          expect(msg.subscribe!.symbols).toBe(symbols);
          expect(msg.subscribe!.account).toBe(account);
          expect(msg.subscribe!.market).toBe(market);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('buildUnSubscribeMessage fields should match input', () => {
    fc.assert(
      fc.property(
        arbDataType,
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        (dataType, symbols, account, market) => {
          const msg = buildUnSubscribeMessage(dataType, symbols, account, market);

          expect(msg.command).toBe(SocketCommon_Command.UNSUBSCRIBE);
          expect(msg.id).toBeGreaterThan(0);
          expect(msg.subscribe).toBeDefined();
          expect(msg.subscribe!.dataType).toBe(dataType);
          expect(msg.subscribe!.symbols).toBe(symbols);
          expect(msg.subscribe!.account).toBe(account);
          expect(msg.subscribe!.market).toBe(market);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 6: Connect message completeness
 *
 * For any valid tigerId, sign, etc. — buildConnectMessage fields match input.
 *
 * **Validates: Requirements 3.2, 11.1**
 */
describe('Property 6: Connect message completeness', () => {
  it('buildConnectMessage fields should match input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),   // tigerId
        fc.string({ minLength: 1, maxLength: 200 }),   // sign
        fc.string({ minLength: 1, maxLength: 30 }),    // sdkVersion
        fc.string({ minLength: 1, maxLength: 10 }),    // acceptVersion
        fc.integer({ min: 1, max: 60_000 }),           // sendInterval
        fc.integer({ min: 1, max: 60_000 }),           // receiveInterval
        fc.boolean(),                                   // useFullTick
        (tigerId, sign, sdkVersion, acceptVersion, sendInterval, receiveInterval, useFullTick) => {
          const msg = buildConnectMessage(
            tigerId, sign, sdkVersion, acceptVersion,
            sendInterval, receiveInterval, useFullTick,
          );

          expect(msg.command).toBe(SocketCommon_Command.CONNECT);
          expect(msg.id).toBeGreaterThan(0);
          expect(msg.connect).toBeDefined();
          expect(msg.connect!.tigerId).toBe(tigerId);
          expect(msg.connect!.sign).toBe(sign);
          expect(msg.connect!.sdkVersion).toBe(sdkVersion);
          expect(msg.connect!.acceptVersion).toBe(acceptVersion);
          expect(msg.connect!.sendInterval).toBe(sendInterval);
          expect(msg.connect!.receiveInterval).toBe(receiveInterval);
          expect(msg.connect!.useFullTick).toBe(useFullTick);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---- Property 7: PushData dispatch correctness ----

/** Create a test ClientConfig */
function testConfig(): ClientConfig {
  return {
    tigerId: 'test_tiger_id',
    privateKey: '',
    account: 'test_account',
    language: 'zh_CN',
    timeout: 15,
    serverUrl: 'https://openapi.tigerfintech.com/gateway',
  };
}

/**
 * Mock TLS socket implementing TLSSocketLike.
 */
class MockTLSSocket implements TLSSocketLike {
  writtenData: Uint8Array[] = [];
  destroyed = false;
  private listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  write(data: Uint8Array): boolean {
    this.writtenData.push(data);
    return true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  simulateConnect(): void {
    this.emit('connect');
  }

  simulateResponse(response: Response): void {
    const bytes = Response.encode(response).finish();
    const framed = encodeVarint32(bytes);
    this.emit('data', Buffer.from(framed));
  }

  simulateData(chunk: Buffer): void {
    this.emit('data', chunk);
  }
}

/**
 * Build a varint32-framed Response buffer from a Response object.
 */
function encodeResponse(response: Response): Buffer {
  const bytes = Response.encode(response).finish();
  const framed = encodeVarint32(bytes);
  return Buffer.from(framed);
}

/**
 * Mapping from DataType to the PushData field name and callback name.
 * This drives the property test generator.
 */
const dataTypeConfig: Array<{
  dataType: SocketCommon_DataType;
  pushDataField: string;
  callbackName: string;
  createData: () => Record<string, unknown>;
}> = [
  {
    dataType: SocketCommon_DataType.Quote,
    pushDataField: 'quoteData',
    callbackName: 'onQuote',
    createData: () => ({ symbol: 'AAPL' }),
  },
  {
    dataType: SocketCommon_DataType.Option,
    pushDataField: 'quoteData',
    callbackName: 'onOption',
    createData: () => ({ symbol: 'AAPL' }),
  },
  {
    dataType: SocketCommon_DataType.Future,
    pushDataField: 'quoteData',
    callbackName: 'onFuture',
    createData: () => ({ symbol: 'ES' }),
  },
  {
    dataType: SocketCommon_DataType.QuoteDepth,
    pushDataField: 'quoteDepthData',
    callbackName: 'onDepth',
    createData: () => ({ symbol: 'AAPL' }),
  },
  {
    dataType: SocketCommon_DataType.TradeTick,
    pushDataField: 'tradeTickData',
    callbackName: 'onTick',
    createData: () => ({ symbol: 'TSLA' }),
  },
  {
    dataType: SocketCommon_DataType.Asset,
    pushDataField: 'assetData',
    callbackName: 'onAsset',
    createData: () => ({ account: 'test', currency: 'USD' }),
  },
  {
    dataType: SocketCommon_DataType.Position,
    pushDataField: 'positionData',
    callbackName: 'onPosition',
    createData: () => ({ account: 'test', symbol: 'AAPL' }),
  },
  {
    dataType: SocketCommon_DataType.OrderStatus,
    pushDataField: 'orderStatusData',
    callbackName: 'onOrder',
    createData: () => ({ account: 'test', symbol: 'AAPL' }),
  },
  {
    dataType: SocketCommon_DataType.OrderTransaction,
    pushDataField: 'orderTransactionData',
    callbackName: 'onTransaction',
    createData: () => ({ account: 'test' }),
  },
  {
    dataType: SocketCommon_DataType.StockTop,
    pushDataField: 'stockTopData',
    callbackName: 'onStockTop',
    createData: () => ({ market: 'US' }),
  },
  {
    dataType: SocketCommon_DataType.OptionTop,
    pushDataField: 'optionTopData',
    callbackName: 'onOptionTop',
    createData: () => ({}),
  },
  {
    dataType: SocketCommon_DataType.Kline,
    pushDataField: 'klineData',
    callbackName: 'onKline',
    createData: () => ({ symbol: 'AAPL' }),
  },
];

/** Generator that picks a random dataType config entry */
const arbDataTypeConfig = fc.constantFrom(...dataTypeConfig);

/**
 * Property 7: PushData dispatch correctness
 *
 * For any valid DataType and corresponding PushData body, construct Response,
 * encode with varint32, simulate receiving it via MockTLSSocket — correct
 * callback fires.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */
describe('Property 7: PushData dispatch correctness', () => {
  let client: PushClient;
  let mockSocket: MockTLSSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = new MockTLSSocket();
    client = new PushClient(testConfig(), {
      autoReconnect: false,
      heartbeatInterval: 60_000, // Long interval to avoid interference
    });
    client.socketFactory = () => mockSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function connectClient(): Promise<void> {
    const connectPromise = client.connect();
    await vi.advanceTimersByTimeAsync(1);
    mockSocket.simulateConnect();
    await vi.advanceTimersByTimeAsync(1);
    mockSocket.simulateResponse(
      Response.fromPartial({ command: SocketCommon_Command.CONNECTED, id: 1 }),
    );
    await connectPromise;
  }

  it('should dispatch PushData to the correct callback for any DataType', async () => {
    // We run this as a loop over all dataType configs rather than inside
    // fc.assert, because each iteration needs async connect/setup with fake timers.
    // This still validates the property across all DataType variants.
    for (const config of dataTypeConfig) {
      // Reset for each iteration
      mockSocket = new MockTLSSocket();
      client = new PushClient(testConfig(), {
        autoReconnect: false,
        heartbeatInterval: 60_000,
      });
      client.socketFactory = () => mockSocket;

      // Set up callback spy
      const callbackSpy = vi.fn();
      const callbacks: Record<string, ReturnType<typeof vi.fn>> = {};
      callbacks[config.callbackName] = callbackSpy;

      // Also set up spies for ALL OTHER callbacks to verify they are NOT called
      const otherSpies: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const other of dataTypeConfig) {
        if (other.callbackName !== config.callbackName) {
          if (!otherSpies[other.callbackName]) {
            otherSpies[other.callbackName] = vi.fn();
            callbacks[other.callbackName] = otherSpies[other.callbackName];
          }
        }
      }

      client.setCallbacks(callbacks);
      await connectClient();

      // Build and send the push data response
      const pushDataPartial: Record<string, unknown> = {
        dataType: config.dataType,
        [config.pushDataField]: config.createData(),
      };
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: PushData.fromPartial(pushDataPartial),
      });

      mockSocket.simulateResponse(response);

      // The correct callback should fire exactly once
      expect(callbackSpy).toHaveBeenCalledTimes(1);

      // No other callbacks should have fired
      for (const [name, spy] of Object.entries(otherSpies)) {
        expect(spy).not.toHaveBeenCalled();
      }

      // Clean up
      client.disconnect();
    }
  });

  it('should dispatch randomly selected DataType to correct callback via varint32 framing', async () => {
    // Property-style: pick random configs and verify dispatch
    const configs = fc.sample(arbDataTypeConfig, 50);

    for (const config of configs) {
      mockSocket = new MockTLSSocket();
      client = new PushClient(testConfig(), {
        autoReconnect: false,
        heartbeatInterval: 60_000,
      });
      client.socketFactory = () => mockSocket;

      const callbackSpy = vi.fn();
      const callbacks: Record<string, ReturnType<typeof vi.fn>> = {};
      callbacks[config.callbackName] = callbackSpy;
      client.setCallbacks(callbacks);

      await connectClient();

      // Build response and encode with varint32
      const pushDataPartial: Record<string, unknown> = {
        dataType: config.dataType,
        [config.pushDataField]: config.createData(),
      };
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: PushData.fromPartial(pushDataPartial),
      });

      // Simulate receiving raw varint32-framed data
      const framedBuf = encodeResponse(response);
      mockSocket.simulateData(framedBuf);

      expect(callbackSpy).toHaveBeenCalledTimes(1);

      client.disconnect();
    }
  });
});
