/**
 * RSA 签名模块测试
 *
 * 测试 loadPrivateKey、signWithRSA 和 verifyWithRSA 函数。
 * 使用 crypto.generateKeyPairSync 生成测试密钥对。
 */
import { describe, test, expect } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import * as fc from 'fast-check';
import { loadPrivateKey, signWithRSA, verifyWithRSA } from '../../src/signer/signer';

/**
 * Extract the raw Base64 content from a PEM string (strip header/footer/newlines).
 */
function pemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Generate a PKCS#1 test key pair, returning the private PEM and public key as Base64.
 */
function generatePKCS1KeyPair(): { privateKeyPem: string; publicKeyBase64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  return {
    privateKeyPem: privateKey as string,
    publicKeyBase64: pemToBase64(publicKey as string),
  };
}

/**
 * Generate a PKCS#8 test key pair, returning the private PEM and public key as Base64.
 */
function generatePKCS8KeyPair(): { privateKeyPem: string; publicKeyBase64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    privateKeyPem: privateKey as string,
    publicKeyBase64: pemToBase64(publicKey as string),
  };
}

/**
 * Generate a raw Base64-encoded test key pair (no PEM header/footer).
 */
function generateRawBase64KeyPair(): { rawBase64: string; publicKeyBase64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'der' },
  });
  const rawBase64 = (privateKey as Buffer).toString('base64');
  return {
    rawBase64,
    publicKeyBase64: pemToBase64(publicKey as string),
  };
}

describe('loadPrivateKey', () => {
  test('加载 PKCS#1 格式私钥', () => {
    const { privateKeyPem } = generatePKCS1KeyPair();
    const key = loadPrivateKey(privateKeyPem);
    expect(key).toBeDefined();
    expect(key.type).toBe('private');
  });

  test('加载 PKCS#8 格式私钥', () => {
    const { privateKeyPem } = generatePKCS8KeyPair();
    const key = loadPrivateKey(privateKeyPem);
    expect(key).toBeDefined();
    expect(key.type).toBe('private');
  });

  test('加载裸 Base64 编码的私钥', () => {
    const { rawBase64 } = generateRawBase64KeyPair();
    const key = loadPrivateKey(rawBase64);
    expect(key).toBeDefined();
    expect(key.type).toBe('private');
  });

  test('空私钥应抛出错误', () => {
    expect(() => loadPrivateKey('')).toThrow();
  });

  test('无效私钥应抛出错误', () => {
    expect(() => loadPrivateKey('invalid-key-data')).toThrow();
  });
});

describe('signWithRSA', () => {
  test('使用 PKCS#1 私钥签名并验签', () => {
    const { privateKeyPem, publicKeyBase64 } = generatePKCS1KeyPair();
    const content = 'tiger_id=test123&timestamp=1234567890';

    const signature = signWithRSA(privateKeyPem, content);
    expect(signature).toBeTruthy();

    // 验证签名是有效的 Base64
    expect(() => Buffer.from(signature, 'base64')).not.toThrow();

    // 使用公钥验签
    expect(verifyWithRSA(publicKeyBase64, content, signature)).toBe(true);
  });

  test('使用 PKCS#8 私钥签名并验签', () => {
    const { privateKeyPem, publicKeyBase64 } = generatePKCS8KeyPair();
    const content = 'biz_content={}&method=market_state';

    const signature = signWithRSA(privateKeyPem, content);
    expect(signature).toBeTruthy();
    expect(verifyWithRSA(publicKeyBase64, content, signature)).toBe(true);
  });

  test('不同内容产生不同签名', () => {
    const { privateKeyPem } = generatePKCS1KeyPair();
    const sig1 = signWithRSA(privateKeyPem, 'content1');
    const sig2 = signWithRSA(privateKeyPem, 'content2');
    expect(sig1).not.toBe(sig2);
  });

  test('无效私钥应抛出错误', () => {
    expect(() => signWithRSA('invalid-key', 'test content')).toThrow();
  });
});

/**
 * Feature: multi-language-sdks, Property 4: RSA 签名-验签 round-trip
 *
 * 对于任意非空字符串内容和有效的 RSA 密钥对，使用私钥对内容进行
 * SHA1WithRSA 签名后，使用对应公钥验签应成功。
 *
 * **Validates: Requirements 3.2**
 */
describe('Property 4: RSA 签名-验签 round-trip', () => {
  // Pre-generate key pair to avoid generating on every iteration (too slow)
  const { privateKeyPem, publicKeyBase64 } = generatePKCS1KeyPair();

  test('任意非空字符串签名后验签应成功', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (content) => {
          const signature = signWithRSA(privateKeyPem, content);
          // 签名结果非空
          expect(signature.length).toBeGreaterThan(0);
          // 验签应成功
          expect(verifyWithRSA(publicKeyBase64, content, signature)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
