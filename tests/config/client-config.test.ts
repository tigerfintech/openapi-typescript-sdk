/**
 * ClientConfig 单元测试和属性测试
 * 测试客户端配置的创建、默认值、环境变量优先级和必填字段校验
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createClientConfig } from '../../src/config/client-config';
import type { ClientConfig, ClientConfigOptions } from '../../src/config/client-config';

/**
 * 辅助函数：写入临时 properties 文件并返回路径
 */
async function writeTempFile(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
  const filePath = path.join(dir, 'test.properties');
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/** 保存和恢复环境变量的辅助 */
function saveEnv(...keys: string[]): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of keys) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

const ENV_KEYS = ['TIGEROPEN_TIGER_ID', 'TIGEROPEN_PRIVATE_KEY', 'TIGEROPEN_ACCOUNT'];

describe('createClientConfig', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = saveEnv(...ENV_KEYS);
    // 清除环境变量，避免干扰测试
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    restoreEnv(savedEnv);
  });

  it('通过选项设置所有字段', () => {
    const config = createClientConfig({
      tigerId: 'test_tiger_id',
      privateKey: 'test_private_key',
      account: 'DU123456',
      language: 'en_US',
      timezone: 'America/New_York',
      timeout: 30,
      sandboxDebug: true,
    });

    expect(config.tigerId).toBe('test_tiger_id');
    expect(config.privateKey).toBe('test_private_key');
    expect(config.account).toBe('DU123456');
    expect(config.language).toBe('en_US');
    expect(config.timezone).toBe('America/New_York');
    expect(config.timeout).toBe(30);
    expect(config.sandboxDebug).toBe(true);
  });

  it('设置默认值', () => {
    const config = createClientConfig({
      tigerId: 'tid',
      privateKey: 'pk',
    });

    expect(config.language).toBe('zh_CN');
    expect(config.timeout).toBe(15);
    expect(config.sandboxDebug).toBe(false);
    expect(config.serverUrl).toBe('https://openapi.tigerfintech.com/gateway');
  });

  it('沙箱模式使用沙箱 URL', () => {
    const config = createClientConfig({
      tigerId: 'tid',
      privateKey: 'pk',
      sandboxDebug: true,
    });

    expect(config.serverUrl).toBe('https://openapi-sandbox.tigerfintech.com/gateway');
  });

  it('缺少 tigerId 时抛出错误', () => {
    expect(() => createClientConfig({
      privateKey: 'pk',
    } as ClientConfigOptions)).toThrow(/tiger_id|tigerId/i);
  });

  it('缺少 privateKey 时抛出错误', () => {
    expect(() => createClientConfig({
      tigerId: 'tid',
    } as ClientConfigOptions)).toThrow(/private_key|privateKey/i);
  });

  it('环境变量覆盖代码设置', () => {
    process.env['TIGEROPEN_TIGER_ID'] = 'env_tiger_id';
    process.env['TIGEROPEN_PRIVATE_KEY'] = 'env_private_key';
    process.env['TIGEROPEN_ACCOUNT'] = 'env_account';

    const config = createClientConfig({
      tigerId: 'code_tiger_id',
      privateKey: 'code_private_key',
      account: 'code_account',
    });

    expect(config.tigerId).toBe('env_tiger_id');
    expect(config.privateKey).toBe('env_private_key');
    expect(config.account).toBe('env_account');
  });

  it('环境变量部分覆盖', () => {
    process.env['TIGEROPEN_TIGER_ID'] = 'env_tid';

    const config = createClientConfig({
      tigerId: 'code_tid',
      privateKey: 'code_pk',
      account: 'code_acc',
    });

    expect(config.tigerId).toBe('env_tid');
    expect(config.privateKey).toBe('code_pk');
    expect(config.account).toBe('code_acc');
  });

  it('从配置文件加载', async () => {
    const content = 'tiger_id=file_tid\nprivate_key=file_pk\naccount=file_acc\nlicense=TBNZ\n';
    const filePath = await writeTempFile(content);

    const config = createClientConfig({
      propertiesFilePath: filePath,
    });

    expect(config.tigerId).toBe('file_tid');
    expect(config.privateKey).toBe('file_pk');
    expect(config.account).toBe('file_acc');
    expect(config.license).toBe('TBNZ');
  });

  it('环境变量优先级高于配置文件', async () => {
    const content = 'tiger_id=file_tid\nprivate_key=file_pk\naccount=file_acc\n';
    const filePath = await writeTempFile(content);

    process.env['TIGEROPEN_TIGER_ID'] = 'env_tid';

    const config = createClientConfig({
      propertiesFilePath: filePath,
    });

    expect(config.tigerId).toBe('env_tid');
    expect(config.privateKey).toBe('file_pk');
  });

  it('Token 相关字段', () => {
    const config = createClientConfig({
      tigerId: 'tid',
      privateKey: 'pk',
      token: 'my_token',
      tokenRefreshDuration: 3600,
    });

    expect(config.token).toBe('my_token');
    expect(config.tokenRefreshDuration).toBe(3600);
  });

  it('License 字段', () => {
    const config = createClientConfig({
      tigerId: 'tid',
      privateKey: 'pk',
      license: 'TBHK',
    });

    expect(config.license).toBe('TBHK');
  });

  it('从配置文件加载 PKCS#1 私钥', async () => {
    const content = 'tiger_id=tid\nprivate_key_pk1=pk1_key_content\naccount=acc\n';
    const filePath = await writeTempFile(content);

    const config = createClientConfig({
      propertiesFilePath: filePath,
    });

    expect(config.privateKey).toBe('pk1_key_content');
  });

  it('从配置文件加载 PKCS#8 私钥', async () => {
    const content = 'tiger_id=tid\nprivate_key_pk8=pk8_key_content\naccount=acc\n';
    const filePath = await writeTempFile(content);

    const config = createClientConfig({
      propertiesFilePath: filePath,
    });

    expect(config.privateKey).toBe('pk8_key_content');
  });
});

// Feature: multi-language-sdks, Property 2: ClientConfig 字段设置 round-trip
// **Validates: Requirements 2.1, 2.6**
//
// 对于任意有效的配置参数组合，通过代码设置到 ClientConfig 后，
// 读取各字段的值应与设置的值完全一致。
describe('Property 2: ClientConfig 字段设置 round-trip', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = saveEnv(...ENV_KEYS);
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    restoreEnv(savedEnv);
  });

  it('任意有效配置参数设置后读取应一致', () => {
    fc.assert(
      fc.property(
        fc.record({
          tigerId: fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
          privateKey: fc.stringMatching(/^[a-zA-Z0-9]{1,100}$/),
          account: fc.stringMatching(/^[A-Z]{2}[0-9]{4,10}$/),
          language: fc.constantFrom('zh_CN', 'zh_TW', 'en_US'),
          timezone: fc.stringMatching(/^[A-Za-z/_]{3,30}$/),
          timeout: fc.integer({ min: 1, max: 120 }),
          sandboxDebug: fc.boolean(),
        }),
        (params) => {
          const config = createClientConfig({
            tigerId: params.tigerId,
            privateKey: params.privateKey,
            account: params.account,
            language: params.language,
            timezone: params.timezone,
            timeout: params.timeout,
            sandboxDebug: params.sandboxDebug,
          });

          // 验证 round-trip
          expect(config.tigerId).toBe(params.tigerId);
          expect(config.privateKey).toBe(params.privateKey);
          expect(config.account).toBe(params.account);
          expect(config.language).toBe(params.language);
          expect(config.timezone).toBe(params.timezone);
          expect(config.timeout).toBe(params.timeout);
          expect(config.sandboxDebug).toBe(params.sandboxDebug);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: multi-language-sdks, Property 3: 环境变量优先级高于配置文件
// **Validates: Requirements 2.4**
//
// 对于任意配置字段（tiger_id、private_key、account），当环境变量和配置文件同时提供该字段的值时，
// ClientConfig 最终使用的值应等于环境变量中的值。
describe('Property 3: 环境变量优先级高于配置文件', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = saveEnv(...ENV_KEYS);
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    restoreEnv(savedEnv);
  });

  it('环境变量值应覆盖配置文件值', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileTigerId: fc.stringMatching(/^file_[a-zA-Z0-9]{1,15}$/),
          filePrivateKey: fc.stringMatching(/^file_[a-zA-Z0-9]{1,50}$/),
          fileAccount: fc.stringMatching(/^file_[A-Z]{2}[0-9]{4,8}$/),
          envTigerId: fc.stringMatching(/^env_[a-zA-Z0-9]{1,15}$/),
          envPrivateKey: fc.stringMatching(/^env_[a-zA-Z0-9]{1,50}$/),
          envAccount: fc.stringMatching(/^env_[A-Z]{2}[0-9]{4,8}$/),
        }),
        async (params) => {
          // 写入配置文件
          const content = `tiger_id=${params.fileTigerId}\nprivate_key=${params.filePrivateKey}\naccount=${params.fileAccount}\n`;
          const filePath = await writeTempFile(content);

          // 设置环境变量
          process.env['TIGEROPEN_TIGER_ID'] = params.envTigerId;
          process.env['TIGEROPEN_PRIVATE_KEY'] = params.envPrivateKey;
          process.env['TIGEROPEN_ACCOUNT'] = params.envAccount;

          const config = createClientConfig({
            propertiesFilePath: filePath,
          });

          // 环境变量应覆盖配置文件
          expect(config.tigerId).toBe(params.envTigerId);
          expect(config.privateKey).toBe(params.envPrivateKey);
          expect(config.account).toBe(params.envAccount);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
