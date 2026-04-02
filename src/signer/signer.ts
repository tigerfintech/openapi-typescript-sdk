/**
 * RSA 签名模块
 *
 * 提供 RSA 私钥加载、SHA1WithRSA 签名和验签功能。
 * 支持 PKCS#1、PKCS#8 PEM 格式以及裸 Base64 编码。
 */
import { createSign, createVerify, createPrivateKey, KeyObject } from 'crypto';

/**
 * 加载 RSA 私钥，支持以下格式：
 * - PKCS#1 PEM（BEGIN RSA PRIVATE KEY）
 * - PKCS#8 PEM（BEGIN PRIVATE KEY）
 * - 裸 Base64 编码的 DER 数据（无 PEM 头尾）
 *
 * @param keyStr - 私钥字符串
 * @returns KeyObject 私钥对象
 * @throws 私钥为空或格式无效时抛出错误
 */
export function loadPrivateKey(keyStr: string): KeyObject {
  if (!keyStr) {
    throw new Error('私钥不能为空');
  }

  // 尝试 PEM 格式（PKCS#1 或 PKCS#8）
  if (keyStr.includes('-----BEGIN')) {
    try {
      return createPrivateKey(keyStr);
    } catch {
      throw new Error('无法解析私钥：PEM 格式无效');
    }
  }

  // 非 PEM 格式，尝试作为裸 Base64 解码
  // 先尝试 PKCS#1，再尝试 PKCS#8
  const derBuffer = Buffer.from(keyStr, 'base64');
  if (derBuffer.length === 0) {
    throw new Error('无法解析私钥：不是有效的 PEM 或 Base64 格式');
  }

  // 尝试 PKCS#1 DER
  try {
    return createPrivateKey({
      key: derBuffer,
      format: 'der',
      type: 'pkcs1',
    });
  } catch {
    // 继续尝试 PKCS#8
  }

  // 尝试 PKCS#8 DER
  try {
    return createPrivateKey({
      key: derBuffer,
      format: 'der',
      type: 'pkcs8',
    });
  } catch {
    throw new Error('无法解析私钥：不是有效的 PKCS#1 或 PKCS#8 格式');
  }
}

/**
 * 使用 RSA 私钥对内容进行 SHA1WithRSA 签名，返回 Base64 编码的签名字符串。
 *
 * @param privateKeyStr - 私钥字符串（支持 PKCS#1/PKCS#8 PEM 或裸 Base64）
 * @param content - 待签名内容
 * @returns Base64 编码的签名字符串
 * @throws 私钥无效或签名失败时抛出错误
 */
export function signWithRSA(privateKeyStr: string, content: string): string {
  const key = loadPrivateKey(privateKeyStr);
  const sign = createSign('SHA1');
  sign.update(content);
  sign.end();
  return sign.sign(key, 'base64');
}

/**
 * 使用 RSA 公钥验证 SHA1WithRSA 签名。
 *
 * @param publicKey - 公钥对象
 * @param content - 原始内容
 * @param signature - Base64 编码的签名字符串
 * @returns 验签是否成功
 */
export function verifyWithRSA(
  publicKey: KeyObject,
  content: string,
  signature: string,
): boolean {
  const verify = createVerify('SHA1');
  verify.update(content);
  verify.end();
  return verify.verify(publicKey, signature, 'base64');
}
