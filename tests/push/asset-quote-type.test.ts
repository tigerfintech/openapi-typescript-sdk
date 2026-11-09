/**
 * assetQuoteType 订阅参数测试（protobuf 通道）
 *
 * 覆盖:
 * - Request.Subscribe 的 wire 格式: 字段号 5、wire type 2(length-delimited)
 * - buildSubscribeMessage 透传 assetQuoteType
 * - PushClient.subscribeAsset / subscribePosition 的重载(字符串 account vs 选项对象)
 * - 重连后 resubscribe 保留 assetQuoteType
 * - 老签名 subscribeAsset(account) 不带该字段(向后兼容)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PushClient } from '../../src/push/push-client';
import type { TLSSocketLike } from '../../src/push/push-client';
import { buildSubscribeMessage } from '../../src/push/proto-message';
import { Request, Request_Subscribe } from '../../src/push/pb/Request';
import { Response } from '../../src/push/pb/Response';
import { SocketCommon_Command, SocketCommon_DataType } from '../../src/push/pb/SocketCommon';
import { encodeVarint32, decodeVarint32 } from '../../src/push/varint';
import type { ClientConfig } from '../../src/config/client-config';

vi.mock('../../src/signer/signer', () => ({
  signWithRSA: vi.fn().mockReturnValue('mock_signature'),
  loadPrivateKey: vi.fn(),
}));

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

class MockTLSSocket implements TLSSocketLike {
  writtenData: Uint8Array[] = [];
  private listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  write(data: Uint8Array): boolean {
    this.writtenData.push(data);
    return true;
  }
  destroy(): void {}
  on(event: string, listener: (...args: unknown[]) => void): this {
    (this.listeners[event] ??= []).push(listener);
    return this;
  }
  emit(event: string, ...args: unknown[]): void {
    for (const h of this.listeners[event] ?? []) h(...args);
  }
  simulateConnect(): void {
    this.emit('connect');
  }
  simulateResponse(response: Response): void {
    this.emit('data', Buffer.from(encodeVarint32(Response.encode(response).finish())));
  }
  simulateClose(): void {
    this.emit('close');
  }
  getSentRequest(index: number): Request {
    const frame = decodeVarint32(this.writtenData[index]);
    if (!frame) throw new Error('Failed to decode varint32 frame');
    return Request.decode(frame.message);
  }
}

// ===== 1. wire 格式断言 =====

describe('Request.Subscribe.assetQuoteType wire 格式', () => {
  it('应编码为字段号 5 + wire type 2 的字符串', () => {
    const bytes = Request_Subscribe.encode(
      Request_Subscribe.fromPartial({
        dataType: SocketCommon_DataType.Asset,
        assetQuoteType: 'OVERNIGHT',
      }),
    ).finish();

    // tag = (5 << 3) | 2 = 42 (0x2a),后接 varint 长度 9 和 "OVERNIGHT" 的 UTF-8 字节
    expect(Array.from(bytes)).toEqual([
      0x08, SocketCommon_DataType.Asset,
      0x2a, 0x09, ...Array.from(Buffer.from('OVERNIGHT', 'utf8')),
    ]);

    const decoded = Request_Subscribe.decode(bytes);
    expect(decoded.assetQuoteType).toBe('OVERNIGHT');
  });

  it('嵌在 Request 里也能 roundtrip', () => {
    const bytes = Request.encode(
      Request.fromPartial({
        command: SocketCommon_Command.SUBSCRIBE,
        id: 1,
        subscribe: {
          dataType: SocketCommon_DataType.Position,
          account: 'U1234567',
          assetQuoteType: 'RTH',
        },
      }),
    ).finish();

    const decoded = Request.decode(bytes);
    expect(decoded.subscribe!.account).toBe('U1234567');
    expect(decoded.subscribe!.assetQuoteType).toBe('RTH');
  });

  it('不传时不应出现在 wire 上', () => {
    const bytes = Request_Subscribe.encode(
      Request_Subscribe.fromPartial({
        dataType: SocketCommon_DataType.Asset,
        account: 'U1234567',
      }),
    ).finish();

    expect(Array.from(bytes)).not.toContain(0x2a);
    expect(Request_Subscribe.decode(bytes).assetQuoteType).toBeUndefined();
  });

  it('buildSubscribeMessage 透传 assetQuoteType', () => {
    const msg = buildSubscribeMessage(
      SocketCommon_DataType.Position,
      undefined,
      'U1234567',
      undefined,
      'ETH',
    );
    expect(msg.command).toBe(SocketCommon_Command.SUBSCRIBE);
    expect(msg.subscribe!.assetQuoteType).toBe('ETH');
  });

  it('buildSubscribeMessage 省略该参数时保持 undefined', () => {
    const msg = buildSubscribeMessage(SocketCommon_DataType.Asset, undefined, 'U1234567');
    expect(msg.subscribe!.assetQuoteType).toBeUndefined();
  });
});

// ===== 2. PushClient 重载 =====

describe('PushClient 资产/持仓订阅的 assetQuoteType 重载', () => {
  let client: PushClient;
  let mockSocket: MockTLSSocket;

  async function connectClient(): Promise<void> {
    const p = client.connect();
    await vi.advanceTimersByTimeAsync(1);
    mockSocket.simulateConnect();
    await vi.advanceTimersByTimeAsync(1);
    mockSocket.simulateResponse(
      Response.fromPartial({ command: SocketCommon_Command.CONNECTED, id: 1 }),
    );
    await p;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = new MockTLSSocket();
    client = new PushClient(testConfig(), { autoReconnect: false });
    client.socketFactory = () => mockSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribeAsset(options) 应带上 assetQuoteType', async () => {
    await connectClient();
    const before = mockSocket.writtenData.length;
    client.subscribeAsset({ assetQuoteType: 'OVERNIGHT' });

    const req = mockSocket.getSentRequest(before);
    expect(req.command).toBe(SocketCommon_Command.SUBSCRIBE);
    expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.Asset);
    expect(req.subscribe!.account).toBe('test_account');
    expect(req.subscribe!.assetQuoteType).toBe('OVERNIGHT');
  });

  it('subscribeAsset(options) 可同时指定 account', async () => {
    await connectClient();
    const before = mockSocket.writtenData.length;
    client.subscribeAsset({ account: 'U7654321', assetQuoteType: 'RTH' });

    const req = mockSocket.getSentRequest(before);
    expect(req.subscribe!.account).toBe('U7654321');
    expect(req.subscribe!.assetQuoteType).toBe('RTH');
  });

  it('subscribePosition(options) 应带上 assetQuoteType', async () => {
    await connectClient();
    const before = mockSocket.writtenData.length;
    client.subscribePosition({ assetQuoteType: 'ETH' });

    const req = mockSocket.getSentRequest(before);
    expect(req.subscribe!.dataType).toBe(SocketCommon_DataType.Position);
    expect(req.subscribe!.account).toBe('test_account');
    expect(req.subscribe!.assetQuoteType).toBe('ETH');
  });

  it('老签名 subscribeAsset(account) 行为不变,不带 assetQuoteType', async () => {
    await connectClient();
    const before = mockSocket.writtenData.length;
    client.subscribeAsset('U7654321');

    const req = mockSocket.getSentRequest(before);
    expect(req.subscribe!.account).toBe('U7654321');
    expect(req.subscribe!.assetQuoteType).toBeUndefined();
  });

  it('老签名 subscribePosition() 无参调用行为不变', async () => {
    await connectClient();
    const before = mockSocket.writtenData.length;
    client.subscribePosition();

    const req = mockSocket.getSentRequest(before);
    expect(req.subscribe!.account).toBe('test_account');
    expect(req.subscribe!.assetQuoteType).toBeUndefined();
  });

  it('重连 resubscribe 应保留 assetQuoteType', async () => {
    client = new PushClient(testConfig(), { autoReconnect: true, reconnectInterval: 1000 });
    const sockets: MockTLSSocket[] = [];
    client.socketFactory = () => {
      const s = new MockTLSSocket();
      sockets.push(s);
      return s;
    };

    // 首次连接
    const p1 = client.connect();
    await vi.advanceTimersByTimeAsync(1);
    sockets[0].simulateConnect();
    await vi.advanceTimersByTimeAsync(1);
    sockets[0].simulateResponse(
      Response.fromPartial({ command: SocketCommon_Command.CONNECTED, id: 1 }),
    );
    await p1;

    client.subscribeAsset({ assetQuoteType: 'OVERNIGHT' });

    // 断开 → 触发自动重连
    sockets[0].simulateClose();
    await vi.advanceTimersByTimeAsync(1100);
    expect(sockets.length).toBe(2);
    sockets[1].simulateConnect();
    await vi.advanceTimersByTimeAsync(1);
    sockets[1].simulateResponse(
      Response.fromPartial({ command: SocketCommon_Command.CONNECTED, id: 2 }),
    );
    await vi.advanceTimersByTimeAsync(1);

    // 新连接上: [0] = CONNECT, 之后是 resubscribe
    const resubscribed = sockets[1].writtenData
      .map((_, i) => sockets[1].getSentRequest(i))
      .filter((r) => r.command === SocketCommon_Command.SUBSCRIBE);
    expect(resubscribed.length).toBeGreaterThanOrEqual(1);
    const assetReq = resubscribed.find(
      (r) => r.subscribe!.dataType === SocketCommon_DataType.Asset,
    );
    expect(assetReq).toBeDefined();
    expect(assetReq!.subscribe!.assetQuoteType).toBe('OVERNIGHT');

    client.disconnect();
  });
});
