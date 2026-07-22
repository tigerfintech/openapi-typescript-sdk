/**
 * 推送消息类型测试（Protobuf 协议）
 *
 * 旧的 JSON 消息测试已移除。仅保留 SubjectType 枚举的基本验证。
 */
import { describe, it, expect } from 'vitest';
import { SubjectType } from '../../src/push/push-message';

describe('SubjectType 枚举', () => {
  it('应包含所有预期的订阅主题类型', () => {
    expect(SubjectType.Quote).toBe('quote');
    expect(SubjectType.Tick).toBe('tick');
    expect(SubjectType.Depth).toBe('depth');
    expect(SubjectType.Option).toBe('option');
    expect(SubjectType.Future).toBe('future');
    expect(SubjectType.Kline).toBe('kline');
    expect(SubjectType.StockTop).toBe('stock_top');
    expect(SubjectType.OptionTop).toBe('option_top');
    expect(SubjectType.FullTick).toBe('full_tick');
    expect(SubjectType.QuoteBBO).toBe('quote_bbo');
    expect(SubjectType.Asset).toBe('asset');
    expect(SubjectType.Position).toBe('position');
    expect(SubjectType.Order).toBe('order');
    expect(SubjectType.Transaction).toBe('transaction');
  });
});
