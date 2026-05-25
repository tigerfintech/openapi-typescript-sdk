/**
 * TokenManager 测试
 */
import { describe, it, expect, afterEach } from 'vitest';
import { TokenManager } from '../../src/config/token-manager';
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'tigeropen-token-test-' + Date.now());

function setup() {
  mkdirSync(testDir, { recursive: true });
}

function cleanup() {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
}

describe('TokenManager', () => {
  afterEach(cleanup);

  it('从文件加载 Token', async () => {
    setup();
    const path = join(testDir, 'token.properties');
    writeFileSync(path, 'token=test_token_123\n');
    const m = new TokenManager({ filePath: path });
    const token = await m.loadToken();
    expect(token).toBe('test_token_123');
    expect(m.getToken()).toBe('test_token_123');
  });

  it('loadTokenSync 从文件加载 Token', () => {
    setup();
    const path = join(testDir, 'token.properties');
    writeFileSync(path, 'token=sync_token_789\n');
    const m = new TokenManager({ filePath: path });
    const token = m.loadTokenSync();
    expect(token).toBe('sync_token_789');
    expect(m.getToken()).toBe('sync_token_789');
  });

  it('文件不存在时抛出错误', async () => {
    const m = new TokenManager({ filePath: '/nonexistent/path' });
    await expect(m.loadToken()).rejects.toThrow();
  });

  it('无 token 字段时抛出错误', async () => {
    setup();
    const path = join(testDir, 'token.properties');
    writeFileSync(path, 'other_key=value\n');
    const m = new TokenManager({ filePath: path });
    await expect(m.loadToken()).rejects.toThrow('Token 文件中未找到 token 字段');
  });

  it('设置 Token 并更新文件', () => {
    setup();
    const path = join(testDir, 'token.properties');
    const m = new TokenManager({ filePath: path });
    m.setToken('new_token_456');
    expect(m.getToken()).toBe('new_token_456');
    const content = readFileSync(path, 'utf-8');
    expect(content).toBe('token=new_token_456\n');
  });

  it('setToken 无 filePath 时不写文件（fileEnabled=false）', () => {
    // 不传 filePath → fileEnabled = false，setToken 仅更新内存
    const m = new TokenManager();
    m.setToken('memory_only_token');
    expect(m.getToken()).toBe('memory_only_token');
  });

  it('syncToken 更新内存但不触发 tokenWriter', () => {
    const written: string[] = [];
    const path = join(testDir, 'token.properties');
    setup();
    const m = new TokenManager({
      filePath: path,
      tokenWriter: (t) => written.push(t),
    });
    m.syncToken('synced_token');
    expect(m.getToken()).toBe('synced_token');
    expect(written).toHaveLength(0);
  });

  it('setToken 触发 tokenWriter 回调', () => {
    const written: string[] = [];
    const m = new TokenManager({
      tokenWriter: (t) => written.push(t),
    });
    m.setToken('callback_token');
    expect(written).toEqual(['callback_token']);
  });

  it('设置后重新加载 Token', async () => {
    setup();
    const path = join(testDir, 'token.properties');
    const m1 = new TokenManager({ filePath: path });
    m1.setToken('round_trip_token');
    const m2 = new TokenManager({ filePath: path });
    expect(await m2.loadToken()).toBe('round_trip_token');
  });

  it('停止未启动的刷新不报错', () => {
    const m = new TokenManager();
    expect(() => m.stopAutoRefresh()).not.toThrow();
  });

  it('tokenLoader 优先于文件加载', async () => {
    const m = new TokenManager({
      tokenLoader: () => 'loader_token',
    });
    const token = await m.loadToken();
    expect(token).toBe('loader_token');
    expect(m.getToken()).toBe('loader_token');
  });

  it('异步 tokenLoader 正常工作', async () => {
    const m = new TokenManager({
      tokenLoader: async () => 'async_loader_token',
    });
    const token = await m.loadToken();
    expect(token).toBe('async_loader_token');
  });

  it('tokenLoader 返回空值时抛出错误', async () => {
    const m = new TokenManager({
      tokenLoader: () => '',
    });
    await expect(m.loadToken()).rejects.toThrow('自定义 tokenLoader 返回空值');
  });
});

/** 构造测试用 base64 token，前 27 字符包含 "gen_ts_ms,expire_ts_ms" */
function makeTestToken(genTsMs: number, expireTsMs: number): string {
  const header = `${String(genTsMs).padStart(13, '0')},${String(expireTsMs).padStart(13, '0')}`;
  const payload = header + 'some_extra_payload_data';
  return Buffer.from(payload).toString('base64');
}

describe('TokenManager shouldTokenRefresh', () => {
  it('空 token 不需要刷新', () => {
    const m = new TokenManager({ refreshDuration: 30 });
    expect(m.shouldTokenRefresh()).toBe(false);
  });

  it('refreshDuration 为 0 时不刷新', () => {
    const m = new TokenManager({ refreshDuration: 0 });
    m.setToken(makeTestToken(1000000, 2000000));
    expect(m.shouldTokenRefresh()).toBe(false);
  });

  it('token 已过期时需要刷新', () => {
    setup();
    const path = join(testDir, 'token.properties');
    const m = new TokenManager({ filePath: path, refreshDuration: 30 });
    // gen_ts 在 100 秒前
    const oldGenTs = (Math.floor(Date.now() / 1000) - 100) * 1000;
    m.setToken(makeTestToken(oldGenTs, oldGenTs + 3600000));
    expect(m.shouldTokenRefresh()).toBe(true);
  });

  it('token 未过期时不需要刷新', () => {
    setup();
    const path = join(testDir, 'token.properties');
    const m = new TokenManager({ filePath: path, refreshDuration: 3600 });
    // gen_ts 刚刚生成
    const freshGenTs = Date.now();
    m.setToken(makeTestToken(freshGenTs, freshGenTs + 7200000));
    expect(m.shouldTokenRefresh()).toBe(false);
  });

  it('无效 base64 token 不需要刷新', () => {
    const m = new TokenManager({ refreshDuration: 30 });
    m.setToken('not_valid_base64!!!');
    expect(m.shouldTokenRefresh()).toBe(false);
  });
});
