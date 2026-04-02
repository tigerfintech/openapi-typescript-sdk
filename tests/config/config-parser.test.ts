/**
 * ConfigParser 单元测试和属性测试
 * 测试 Java properties 格式配置文件的解析功能
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parsePropertiesFile, parsePropertiesString } from '../../src/config/config-parser';

/**
 * 辅助函数：写入临时 properties 文件并返回路径
 */
async function writeTempFile(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
  const filePath = path.join(dir, 'test.properties');
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('parsePropertiesFile', () => {
  it('解析基本键值对', async () => {
    const content = 'tiger_id=test123\nprivate_key=mykey\naccount=DU123456\n';
    const filePath = await writeTempFile(content);

    const props = await parsePropertiesFile(filePath);

    expect(props['tiger_id']).toBe('test123');
    expect(props['private_key']).toBe('mykey');
    expect(props['account']).toBe('DU123456');
  });

  it('忽略 # 和 ! 注释行', async () => {
    const content = '# 这是注释\ntiger_id=abc\n! 这也是注释\naccount=DU001\n';
    const filePath = await writeTempFile(content);

    const props = await parsePropertiesFile(filePath);

    expect(Object.keys(props)).toHaveLength(2);
    expect(props['tiger_id']).toBe('abc');
    expect(props['account']).toBe('DU001');
  });

  it('忽略空行和纯空白行', async () => {
    const content = '\n\ntiger_id=abc\n\n  \n\naccount=DU001\n\n';
    const filePath = await writeTempFile(content);

    const props = await parsePropertiesFile(filePath);

    expect(Object.keys(props)).toHaveLength(2);
  });

  it('支持反斜杠续行', async () => {
    const content = 'private_key=MIIEvgIBADANBg\\\nkqhkiG9w0BAQ\\\nEFAASCBKgwgg\n';
    const filePath = await writeTempFile(content);

    const props = await parsePropertiesFile(filePath);

    expect(props['private_key']).toBe('MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwgg');
  });

  it('续行时去除下一行前导空格', async () => {
    const content = 'key=hello\\\n    world\n';
    const filePath = await writeTempFile(content);

    const props = await parsePropertiesFile(filePath);

    expect(props['key']).toBe('helloworld');
  });

  it('去除键值两端空格', async () => {
    const content = '  tiger_id  =  test123  \n  account = DU001 \n';
    const filePath = await writeTempFile(content);

    const props = await parsePropertiesFile(filePath);

    expect(props['tiger_id']).toBe('test123');
    expect(props['account']).toBe('DU001');
  });

  it('值中可以包含等号', async () => {
    const content = 'private_key=abc=def=ghi\n';
    const filePath = await writeTempFile(content);

    const props = await parsePropertiesFile(filePath);

    expect(props['private_key']).toBe('abc=def=ghi');
  });

  it('文件不存在时抛出错误', async () => {
    await expect(parsePropertiesFile('/nonexistent/path/config.properties'))
      .rejects.toThrow();
  });

  it('空文件返回空对象', async () => {
    const filePath = await writeTempFile('');

    const props = await parsePropertiesFile(filePath);

    expect(Object.keys(props)).toHaveLength(0);
  });
});

describe('parsePropertiesString', () => {
  it('解析字符串内容', () => {
    const content = 'tiger_id=test123\naccount=DU001\n';
    const props = parsePropertiesString(content);

    expect(props['tiger_id']).toBe('test123');
    expect(props['account']).toBe('DU001');
  });
});

// Feature: multi-language-sdks, Property 1: Properties 配置文件解析 round-trip
// **Validates: Requirements 2.8, 10.7**
//
// 对于任意有效的键值对集合（键和值均为非空字符串，不含特殊字符 #、!、\n），
// 将其序列化为 Java properties 格式后再解析，得到的键值对集合应与原始集合等价。
describe('Property 1: Properties 配置文件解析 round-trip', () => {
  it('任意有效键值对序列化后再解析应等价', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成 1~10 个键值对
        fc.array(
          fc.tuple(
            // 键：字母开头，字母数字下划线组成
            fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/),
            // 值：不含换行、反斜杠、#、! 的可打印字符串
            fc.stringMatching(/^[a-zA-Z0-9.,;@$%^&*()\[\]{}<>/?|~+\-]{1,50}$/)
          ),
          { minLength: 1, maxLength: 10 }
        ),
        async (pairs) => {
          // 去重：保留每个 key 的最后一个值（模拟 properties 文件行为）
          const expected: Record<string, string> = {};
          for (const [key, value] of pairs) {
            expected[key] = value;
          }

          // 序列化为 properties 格式
          const lines = Object.entries(expected).map(([k, v]) => `${k}=${v}`);
          const content = lines.join('\n') + '\n';

          // 写入临时文件并解析
          const filePath = await writeTempFile(content);
          const parsed = await parsePropertiesFile(filePath);

          // 验证 round-trip
          expect(Object.keys(parsed).length).toBe(Object.keys(expected).length);
          for (const [key, value] of Object.entries(expected)) {
            expect(parsed[key]).toBe(value);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
