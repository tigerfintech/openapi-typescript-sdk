/**
 * Varint32 帧编解码器
 *
 * 兼容 Netty 的 ProtobufVarint32FrameDecoder / ProtobufVarint32LengthFieldPrepender。
 * 每个字节低 7 位存数据，最高位为延续标志（1=后续还有字节，0=最后一个字节），最大 5 字节。
 */

/**
 * 在 protobuf 字节前添加 varint32 长度前缀
 *
 * @param data - 待编码的 protobuf 二进制数据
 * @returns varint32 长度前缀 + 原始数据
 */
export function encodeVarint32(data: Uint8Array): Uint8Array {
  const length = data.length;
  const header = encodeVarint32Length(length);
  const result = new Uint8Array(header.length + data.length);
  result.set(header, 0);
  result.set(data, header.length);
  return result;
}

/**
 * 将一个非负整数编码为 varint32 字节序列
 */
function encodeVarint32Length(value: number): Uint8Array {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return new Uint8Array(bytes);
}

/**
 * 从缓冲区解码一个 varint32 帧
 *
 * @param buffer - 包含 varint32 长度前缀 + protobuf 数据的缓冲区
 * @returns 解码结果 `{ message, remaining }`，数据不足时返回 `null`
 */
export function decodeVarint32(
  buffer: Uint8Array,
): { message: Uint8Array; remaining: Uint8Array } | null {
  if (buffer.length === 0) {
    return null;
  }

  // 读取 varint32 长度前缀
  let value = 0;
  let shift = 0;
  let i = 0;

  while (i < buffer.length) {
    // varint32 最多 5 字节
    if (i >= 5) {
      throw new Error('varint32 overflow: more than 5 bytes');
    }

    const byte = buffer[i];
    value |= (byte & 0x7f) << shift;
    i++;

    if ((byte & 0x80) === 0) {
      // 最后一个字节，延续标志为 0
      const messageLength = value >>> 0; // 确保无符号
      const totalNeeded = i + messageLength;

      if (buffer.length < totalNeeded) {
        // 数据不足，等待更多数据
        return null;
      }

      return {
        message: buffer.slice(i, i + messageLength),
        remaining: buffer.slice(i + messageLength),
      };
    }

    shift += 7;
  }

  // 缓冲区中 varint 前缀不完整，等待更多数据
  return null;
}
