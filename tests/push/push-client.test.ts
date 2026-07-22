/**
 * PushClient unit tests (Protobuf protocol, TCP + TLS)
 *
 * Covers: connection authentication, heartbeat, subscribe/unsubscribe,
 * push message reception & dispatch, error handling, disconnect,
 * and TCP stream framing (split/merged packets).
 *
 * Uses a MockTLSSocket that emulates a TLS socket with an EventEmitter-based
 * interface, matching the TLSSocketLike contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PushClient, ConnectionState } from '../../src/push/push-client';
import type { TLSSocketLike } from '../../src/push/push-client';
import { SubjectType } from '../../src/push/push-message';
import { Request } from '../../src/push/pb/Request';
import { Response } from '../../src/push/pb/Response';
import { PushData } from '../../src/push/pb/PushData';
import { SocketCommon_Command, SocketCommon_DataType } from '../../src/push/pb/SocketCommon';
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
import { encodeVarint32, decodeVarint32 } from '../../src/push/varint';
import type { ClientConfig } from '../../src/config/client-config';

// Mock signWithRSA to avoid needing a real private key
vi.mock('../../src/signer/signer', () => ({
  signWithRSA: vi.fn().mockReturnValue('mock_signature'),
  loadPrivateKey: vi.fn(),
}));

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
 * Build a varint32 + Protobuf encoded Response binary,
 * simulating data sent from the server to the client.
 */
function encodeResponse(response: Response): Buffer {
  const bytes = Response.encode(response).finish();
  const framed = encodeVarint32(bytes);
  return Buffer.from(framed);
}

/**
 * Decode a Request message from binary data sent by MockTLSSocket
 */
function decodeRequest(data: Uint8Array): Request {
  const frame = decodeVarint32(data);
  if (!frame) throw new Error('Failed to decode varint32 frame');
  return Request.decode(frame.message);
}

/**
 * Mock TLS socket implementing TLSSocketLike.
 * Uses an event listener map to simulate Node.js EventEmitter behavior.
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

  /** Emit an event to registered listeners */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  /** Simulate TLS handshake complete */
  simulateConnect(): void {
    this.emit('connect');
  }

  /** Simulate receiving a Protobuf Response from the server */
  simulateResponse(response: Response): void {
    const binary = encodeResponse(response);
    this.emit('data', binary);
  }

  /** Simulate receiving raw data chunk */
  simulateData(chunk: Buffer): void {
    this.emit('data', chunk);
  }

  /** Simulate connection close */
  simulateClose(): void {
    this.emit('close');
  }

  /** Simulate connection error */
  simulateError(err: Error): void {
    this.emit('error', err);
  }

  /** Get the Nth sent Request (decoded) */
  getSentRequest(index: number): Request {
    return decodeRequest(this.writtenData[index]);
  }
}

describe('PushClient (Protobuf, TCP + TLS)', () => {
  let client: PushClient;
  let mockSocket: MockTLSSocket;

  /**
   * Helper: connect the client.
   * Creates the socket, triggers TLS handshake, then sends CONNECTED response.
   */
  async function connectClient(): Promise<void> {
    const connectPromise = client.connect();
    // Allow microtasks to settle so the factory runs and 'connect' listener is registered
    await vi.advanceTimersByTimeAsync(1);
    // Simulate TLS handshake complete → triggers authenticate()
    mockSocket.simulateConnect();
    await vi.advanceTimersByTimeAsync(1);
    // Simulate server CONNECTED response
    mockSocket.simulateResponse(
      Response.fromPartial({ command: SocketCommon_Command.CONNECTED, id: 1 }),
    );
    await connectPromise;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = new MockTLSSocket();
    client = new PushClient(testConfig(), {
      autoReconnect: false,
      heartbeatInterval: 10_000,
    });
    client.socketFactory = () => mockSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== 1. Connection & Authentication =====

  describe('Connection & Authentication', () => {
    it('initial state should be Disconnected', () => {
      const c = new PushClient(testConfig());
      expect(c.state).toBe(ConnectionState.Disconnected);
    });

    it('should be Connected after successful connect', async () => {
      await connectClient();
      expect(client.state).toBe(ConnectionState.Connected);
    });

    it('should send varint32 + Protobuf CONNECT message on TLS handshake', async () => {
      await connectClient();

      expect(mockSocket.writtenData.length).toBeGreaterThanOrEqual(1);

      const req = mockSocket.getSentRequest(0);
      expect(req.command).toBe(SocketCommon_Command.CONNECT);
      expect(req.connect).toBeDefined();
      expect(req.connect!.tigerId).toBe('test_tiger_id');
      expect(req.connect!.sign).toBe('mock_signature');
      expect(req.connect!.sdkVersion).toBeTruthy();
      expect(req.id).toBeGreaterThan(0);
    });

    it('CONNECT message should have correct varint32 length prefix', async () => {
      await connectClient();

      const rawData = mockSocket.writtenData[0];
      const frame = decodeVarint32(rawData);
      expect(frame).not.toBeNull();
      const req = Request.decode(frame!.message);
      expect(req.command).toBe(SocketCommon_Command.CONNECT);
    });

    it('should reject duplicate connect', async () => {
      await connectClient();
      await expect(client.connect()).rejects.toThrow('Client is already connected or connecting');
    });

    it('should reject on TLS error during connect', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateError(new Error('ECONNREFUSED'));
      await expect(connectPromise).rejects.toThrow('TLS connection failed');
    });

    it('should reject on connect timeout', async () => {
      client = new PushClient(testConfig(), {
        autoReconnect: false,
        connectTimeout: 100,
      });
      client.socketFactory = () => mockSocket;

      const connectPromise = client.connect();
      // Simulate TLS handshake so authenticate() is called, but never send CONNECTED
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateConnect();
      // Attach the rejection handler before advancing timers to avoid unhandled rejection
      const rejectPromise = expect(connectPromise).rejects.toThrow('Connect timeout');
      // Advance past the timeout without sending CONNECTED response
      await vi.advanceTimersByTimeAsync(200);
      await rejectPromise;
    });
  });

  // ===== 2. Heartbeat =====

  describe('Heartbeat', () => {
    it('should send HEARTBEAT messages periodically after connect', async () => {
      await connectClient();

      const initialCount = mockSocket.writtenData.length; // 1 (CONNECT)

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockSocket.writtenData.length).toBeGreaterThan(initialCount);
      const heartbeatReq = mockSocket.getSentRequest(initialCount);
      expect(heartbeatReq.command).toBe(SocketCommon_Command.HEARTBEAT);
      expect(heartbeatReq.id).toBeGreaterThan(0);
    });

    it('heartbeat request IDs should be incrementing', async () => {
      await connectClient();

      const initialCount = mockSocket.writtenData.length;

      await vi.advanceTimersByTimeAsync(10_000);
      await vi.advanceTimersByTimeAsync(10_000);

      const hb1 = mockSocket.getSentRequest(initialCount);
      const hb2 = mockSocket.getSentRequest(initialCount + 1);
      expect(hb1.command).toBe(SocketCommon_Command.HEARTBEAT);
      expect(hb2.command).toBe(SocketCommon_Command.HEARTBEAT);
      expect(hb2.id).toBeGreaterThan(hb1.id);
    });
  });

  // ===== 3. Subscribe / Unsubscribe =====

  describe('Subscribe / Unsubscribe', () => {
    it('subscribeQuote should send SUBSCRIBE with dataType Quote', async () => {
      await connectClient();

      const beforeCount = mockSocket.writtenData.length;
      client.subscribeQuote(['AAPL', 'TSLA']);

      const req = mockSocket.getSentRequest(beforeCount);
      expect(req.command).toBe(SocketCommon_Command.SUBSCRIBE);
      expect(req.subscribe).toBeDefined();
      expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.Quote);
      expect(req.subscribe!.symbols).toBe('AAPL,TSLA');
    });

    it('unsubscribeQuote should send UNSUBSCRIBE', async () => {
      await connectClient();

      client.subscribeQuote(['AAPL', 'TSLA']);
      const beforeCount = mockSocket.writtenData.length;
      client.unsubscribeQuote(['TSLA']);

      const req = mockSocket.getSentRequest(beforeCount);
      expect(req.command).toBe(SocketCommon_Command.UNSUBSCRIBE);
      expect(req.subscribe).toBeDefined();
      expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.Quote);
    });

    it('SubjectType→DataType mapping: Depth→QuoteDepth', async () => {
      await connectClient();

      const beforeCount = mockSocket.writtenData.length;
      client.subscribeDepth(['AAPL']);

      const req = mockSocket.getSentRequest(beforeCount);
      expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.QuoteDepth);
    });

    it('SubjectType→DataType mapping: Tick→TradeTick', async () => {
      await connectClient();

      const beforeCount = mockSocket.writtenData.length;
      client.subscribeTick(['TSLA']);

      const req = mockSocket.getSentRequest(beforeCount);
      expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.TradeTick);
    });

    it('SubjectType→DataType mapping: Option→Option', async () => {
      await connectClient();

      const beforeCount = mockSocket.writtenData.length;
      client.subscribeOption(['AAPL']);

      const req = mockSocket.getSentRequest(beforeCount);
      expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.Option);
    });

    it('account subscription should include account field', async () => {
      await connectClient();

      const beforeCount = mockSocket.writtenData.length;
      client.subscribeAsset();

      const req = mockSocket.getSentRequest(beforeCount);
      expect(req.command).toBe(SocketCommon_Command.SUBSCRIBE);
      expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.Asset);
      expect(req.subscribe!.account).toBe('test_account');
    });

    it('subscription state management should be correct', async () => {
      await connectClient();

      client.subscribeQuote(['AAPL', 'TSLA']);
      const subs = client.getSubscriptions();
      expect(subs.get(SubjectType.Quote)?.sort()).toEqual(['AAPL', 'TSLA']);

      client.unsubscribeQuote(['TSLA']);
      const subs2 = client.getSubscriptions();
      expect(subs2.get(SubjectType.Quote)).toEqual(['AAPL']);
    });
  });

  // ===== 4. Push message reception & dispatch =====

  describe('Push message reception & dispatch', () => {
    it('Quote push should trigger onQuote callback', async () => {
      const onQuote = vi.fn();
      client.setCallbacks({ onQuote });

      await connectClient();

      const quoteData = QuoteData.fromPartial({ symbol: 'AAPL', latestPrice: 150.25 });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.Quote,
        quoteData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onQuote).toHaveBeenCalledTimes(1);
      expect(onQuote.mock.calls[0][0].symbol).toBe('AAPL');
      expect(onQuote.mock.calls[0][0].latestPrice).toBe(150.25);
    });

    it('QuoteDepth push should trigger onDepth callback', async () => {
      const onDepth = vi.fn();
      client.setCallbacks({ onDepth });

      await connectClient();

      const depthData = QuoteDepthData.fromPartial({ symbol: 'AAPL' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.QuoteDepth,
        quoteDepthData: depthData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onDepth).toHaveBeenCalledTimes(1);
      expect(onDepth.mock.calls[0][0].symbol).toBe('AAPL');
    });

    it('TradeTick push should trigger onTick callback', async () => {
      const onTick = vi.fn();
      client.setCallbacks({ onTick });

      await connectClient();

      const tickData = TradeTickData.fromPartial({ symbol: 'TSLA' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.TradeTick,
        tradeTickData: tickData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onTick).toHaveBeenCalledTimes(1);
      expect(onTick.mock.calls[0][0].symbol).toBe('TSLA');
    });

    it('Asset push should trigger onAsset callback', async () => {
      const onAsset = vi.fn();
      client.setCallbacks({ onAsset });

      await connectClient();

      const assetData = AssetData.fromPartial({ account: 'test_account', currency: 'USD' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.Asset,
        assetData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onAsset).toHaveBeenCalledTimes(1);
      expect(onAsset.mock.calls[0][0].account).toBe('test_account');
    });

    it('Position push should trigger onPosition callback', async () => {
      const onPosition = vi.fn();
      client.setCallbacks({ onPosition });

      await connectClient();

      const positionData = PositionData.fromPartial({ account: 'test_account', symbol: 'AAPL' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.Position,
        positionData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onPosition).toHaveBeenCalledTimes(1);
    });

    it('OrderStatus push should trigger onOrder callback', async () => {
      const onOrder = vi.fn();
      client.setCallbacks({ onOrder });

      await connectClient();

      const orderData = OrderStatusData.fromPartial({ account: 'test_account', symbol: 'AAPL' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.OrderStatus,
        orderStatusData: orderData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onOrder).toHaveBeenCalledTimes(1);
    });

    it('OrderTransaction push should trigger onTransaction callback', async () => {
      const onTransaction = vi.fn();
      client.setCallbacks({ onTransaction });

      await connectClient();

      const txData = OrderTransactionData.fromPartial({ account: 'test_account' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.OrderTransaction,
        orderTransactionData: txData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onTransaction).toHaveBeenCalledTimes(1);
    });

    it('StockTop push should trigger onStockTop callback', async () => {
      const onStockTop = vi.fn();
      client.setCallbacks({ onStockTop });

      await connectClient();

      const stockTopData = StockTopData.fromPartial({});
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.StockTop,
        stockTopData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onStockTop).toHaveBeenCalledTimes(1);
    });

    it('OptionTop push should trigger onOptionTop callback', async () => {
      const onOptionTop = vi.fn();
      client.setCallbacks({ onOptionTop });

      await connectClient();

      const optionTopData = OptionTopData.fromPartial({});
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.OptionTop,
        optionTopData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onOptionTop).toHaveBeenCalledTimes(1);
    });

    it('Kline push should trigger onKline callback', async () => {
      const onKline = vi.fn();
      client.setCallbacks({ onKline });

      await connectClient();

      const klineData = KlineData.fromPartial({ symbol: 'AAPL' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.Kline,
        klineData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onKline).toHaveBeenCalledTimes(1);
    });

    it('Option push should trigger onOption callback', async () => {
      const onOption = vi.fn();
      client.setCallbacks({ onOption });

      await connectClient();

      const quoteData = QuoteData.fromPartial({ symbol: 'AAPL' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.Option,
        quoteData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onOption).toHaveBeenCalledTimes(1);
    });

    it('Future push should trigger onFuture callback', async () => {
      const onFuture = vi.fn();
      client.setCallbacks({ onFuture });

      await connectClient();

      const quoteData = QuoteData.fromPartial({ symbol: 'ES' });
      const pushData = PushData.fromPartial({
        dataType: SocketCommon_DataType.Future,
        quoteData,
      });
      const response = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: pushData,
      });

      mockSocket.simulateResponse(response);

      expect(onFuture).toHaveBeenCalledTimes(1);
    });
  });

  // ===== 5. TCP stream framing =====

  describe('TCP stream framing', () => {
    it('should handle multiple messages in a single data chunk (merged packets)', async () => {
      const onQuote = vi.fn();
      client.setCallbacks({ onQuote });

      await connectClient();

      // Build two response frames and concatenate them
      const resp1 = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: PushData.fromPartial({
          dataType: SocketCommon_DataType.Quote,
          quoteData: QuoteData.fromPartial({ symbol: 'AAPL', latestPrice: 150 }),
        }),
      });
      const resp2 = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: PushData.fromPartial({
          dataType: SocketCommon_DataType.Quote,
          quoteData: QuoteData.fromPartial({ symbol: 'TSLA', latestPrice: 200 }),
        }),
      });

      const frame1 = encodeResponse(resp1);
      const frame2 = encodeResponse(resp2);
      const merged = Buffer.concat([frame1, frame2]);

      mockSocket.simulateData(merged);

      expect(onQuote).toHaveBeenCalledTimes(2);
      expect(onQuote.mock.calls[0][0].symbol).toBe('AAPL');
      expect(onQuote.mock.calls[1][0].symbol).toBe('TSLA');
    });

    it('should handle a message split across multiple data chunks (split packets)', async () => {
      const onQuote = vi.fn();
      client.setCallbacks({ onQuote });

      await connectClient();

      const resp = Response.fromPartial({
        command: SocketCommon_Command.MESSAGE,
        body: PushData.fromPartial({
          dataType: SocketCommon_DataType.Quote,
          quoteData: QuoteData.fromPartial({ symbol: 'GOOG', latestPrice: 100 }),
        }),
      });

      const fullFrame = encodeResponse(resp);
      // Split the frame in the middle
      const mid = Math.floor(fullFrame.length / 2);
      const part1 = fullFrame.subarray(0, mid);
      const part2 = fullFrame.subarray(mid);

      mockSocket.simulateData(Buffer.from(part1));
      expect(onQuote).not.toHaveBeenCalled(); // Incomplete frame

      mockSocket.simulateData(Buffer.from(part2));
      expect(onQuote).toHaveBeenCalledTimes(1);
      expect(onQuote.mock.calls[0][0].symbol).toBe('GOOG');
    });
  });

  // ===== 6. Error handling =====

  describe('Error handling', () => {
    it('ERROR Response should trigger onError callback', async () => {
      const onError = vi.fn();
      client.setCallbacks({ onError });

      await connectClient();

      const response = Response.fromPartial({
        command: SocketCommon_Command.ERROR,
        code: 500,
        msg: 'Internal server error',
      });

      mockSocket.simulateResponse(response);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0][0].message).toContain('Internal server error');
    });

    it('kickout ERROR should trigger onKickout callback', async () => {
      const onKickout = vi.fn();
      const onError = vi.fn();
      client.setCallbacks({ onKickout, onError });

      await connectClient();

      const response = Response.fromPartial({
        command: SocketCommon_Command.ERROR,
        msg: 'kickout: another device logged in',
      });

      mockSocket.simulateResponse(response);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onKickout).toHaveBeenCalledTimes(1);
      expect(onKickout.mock.calls[0][0]).toContain('kickout');
    });

    it('invalid protobuf data should trigger onError callback', async () => {
      const onError = vi.fn();
      client.setCallbacks({ onError });

      await connectClient();

      // Send invalid binary data (valid varint32 prefix but invalid protobuf)
      const invalidData = Buffer.from([3, 0xff, 0xff, 0xff]);
      mockSocket.simulateData(invalidData);

      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  // ===== 7. Disconnect =====

  describe('Disconnect', () => {
    it('disconnect should send DISCONNECT message', async () => {
      await connectClient();

      const beforeCount = mockSocket.writtenData.length;
      client.disconnect();

      expect(mockSocket.writtenData.length).toBeGreaterThan(beforeCount);
      const disconnectReq = mockSocket.getSentRequest(beforeCount);
      expect(disconnectReq.command).toBe(SocketCommon_Command.DISCONNECT);
      expect(disconnectReq.id).toBeGreaterThan(0);
    });

    it('state should be Disconnected after disconnect', async () => {
      await connectClient();

      client.disconnect();
      expect(client.state).toBe(ConnectionState.Disconnected);
    });

    it('disconnect should trigger onDisconnect callback', async () => {
      const onDisconnect = vi.fn();
      client.setCallbacks({ onDisconnect });

      await connectClient();

      client.disconnect();
      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    it('DISCONNECT Response should trigger onDisconnect callback', async () => {
      const onDisconnect = vi.fn();
      client.setCallbacks({ onDisconnect });

      await connectClient();

      const response = Response.fromPartial({
        command: SocketCommon_Command.DISCONNECT,
      });

      mockSocket.simulateResponse(response);

      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    it('disconnect when not connected should not throw', () => {
      expect(() => client.disconnect()).not.toThrow();
    });

    it('disconnect should destroy the socket', async () => {
      await connectClient();

      client.disconnect();
      expect(mockSocket.destroyed).toBe(true);
    });
  });

  // ===== 8. Connection callbacks =====

  describe('Connection callbacks', () => {
    it('successful connect should trigger onConnect callback', async () => {
      const onConnect = vi.fn();
      client.setCallbacks({ onConnect });

      await connectClient();

      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it('receiving CONNECTED Response should not throw', async () => {
      await connectClient();

      // Simulate server sending another CONNECTED response (should be harmless)
      const response = Response.fromPartial({
        command: SocketCommon_Command.CONNECTED,
        id: 1,
      });

      expect(() => mockSocket.simulateResponse(response)).not.toThrow();
    });

    it('receiving HEARTBEAT Response should not throw', async () => {
      await connectClient();

      const response = Response.fromPartial({
        command: SocketCommon_Command.HEARTBEAT,
      });

      expect(() => mockSocket.simulateResponse(response)).not.toThrow();
    });
  });
});
