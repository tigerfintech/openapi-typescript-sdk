/**
 * 请求参数排序拼接模块
 *
 * 按参数名字母序排列所有参数，拼接为 key=value&key=value 格式，
 * 用于构造 RSA 签名的待签名内容。
 */

/**
 * 按参数名字母序排列所有参数，拼接为 key=value&key=value 格式。
 *
 * @param params - 参数名-值映射
 * @returns 拼接后的字符串
 */
export function getSignContent(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${k}=${params[k]}`).join('&');
}
