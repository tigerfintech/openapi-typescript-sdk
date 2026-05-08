/**
 * Order status normalization.
 *
 * 服务端返回的订单状态有时是整数(-2/-1/3/4/5/6/7/8),有时是字符串
 * ("Invalid"/"Submitted"/...)。本模块把二者统一为 Java SDK OrderStatus 的
 * 字符串值。不做跨别名合并。
 *
 * 对齐 Java SDK OrderStatus.java。
 */

import { OrderStatus } from './enums';

/** 把数字状态码映射到字符串,未识别返回空串。 */
function statusIntToString(n: number): string {
  switch (n) {
    case -2:
      return OrderStatus.Invalid;
    case -1:
      return OrderStatus.Initial;
    case 3:
      return OrderStatus.PendingCancel;
    case 4:
      return OrderStatus.Cancelled;
    case 5:
      return OrderStatus.Submitted;
    case 6:
      return OrderStatus.Filled;
    case 7:
      return OrderStatus.Inactive;
    case 8:
      return OrderStatus.PendingSubmit;
  }
  return '';
}

/**
 * 把服务端可能返回的 string/number 订单状态归一为字符串。
 * 字符串原样透传;数字按映射表转换;其他输入返回空串。
 */
export function normalizeOrderStatus(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return statusIntToString(raw);
  return '';
}
