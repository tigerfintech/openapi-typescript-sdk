/**
 * OrderStatus normalization + Code mapping tests.
 */
import { describe, it, expect } from 'vitest';
import { OrderStatus, orderStatusCode } from '../../src/model/enums';
import { normalizeOrderStatus } from '../../src/model/order-status';

describe('normalizeOrderStatus', () => {
  it('maps integer codes to Java SDK string names', () => {
    expect(normalizeOrderStatus(-2)).toBe('Invalid');
    expect(normalizeOrderStatus(-1)).toBe('Initial');
    expect(normalizeOrderStatus(3)).toBe('PendingCancel');
    expect(normalizeOrderStatus(4)).toBe('Cancelled');
    expect(normalizeOrderStatus(5)).toBe('Submitted');
    expect(normalizeOrderStatus(6)).toBe('Filled');
    expect(normalizeOrderStatus(7)).toBe('Inactive');
    expect(normalizeOrderStatus(8)).toBe('PendingSubmit');
  });

  it('passes string values through unchanged', () => {
    for (const s of [
      'Invalid', 'Initial', 'PendingCancel', 'Cancelled',
      'Submitted', 'Filled', 'Inactive', 'PendingSubmit',
      // 未列入 Java 的字符串也原样返回（不做跨别名合并）
      'Held', 'NEW', 'Something',
    ]) {
      expect(normalizeOrderStatus(s)).toBe(s);
    }
  });

  it('returns empty string for unknown numeric code', () => {
    expect(normalizeOrderStatus(99)).toBe('');
    expect(normalizeOrderStatus(0)).toBe('');
  });

  it('returns empty string for null / undefined / objects', () => {
    expect(normalizeOrderStatus(null)).toBe('');
    expect(normalizeOrderStatus(undefined)).toBe('');
    expect(normalizeOrderStatus({})).toBe('');
  });
});

describe('orderStatusCode', () => {
  it('returns the server wire code', () => {
    expect(orderStatusCode(OrderStatus.Invalid)).toBe(-2);
    expect(orderStatusCode(OrderStatus.Initial)).toBe(-1);
    expect(orderStatusCode(OrderStatus.PendingCancel)).toBe(3);
    expect(orderStatusCode(OrderStatus.Cancelled)).toBe(4);
    expect(orderStatusCode(OrderStatus.Submitted)).toBe(5);
    expect(orderStatusCode(OrderStatus.Filled)).toBe(6);
    expect(orderStatusCode(OrderStatus.Inactive)).toBe(7);
    expect(orderStatusCode(OrderStatus.PendingSubmit)).toBe(8);
  });

  it('returns 0 for unknown string', () => {
    expect(orderStatusCode('Unknown')).toBe(0);
  });
});
