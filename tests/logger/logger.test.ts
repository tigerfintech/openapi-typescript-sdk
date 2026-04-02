/**
 * Logger 测试
 */
import { describe, it, expect, vi } from 'vitest';
import {
  DefaultLogger, NopLogger, LogLevel,
  setDefaultLogger, getDefaultLogger,
} from '../../src/logger/logger';

describe('DefaultLogger', () => {
  it('默认级别为 Info，不输出 Debug', () => {
    const l = new DefaultLogger();
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    l.debug('test');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('默认级别为 Info，输出 Info', () => {
    const l = new DefaultLogger();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    l.info('test');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('设置 Debug 级别后输出 Debug', () => {
    const l = new DefaultLogger();
    l.setLevel(LogLevel.Debug);
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    l.debug('test');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('设置 Error 级别后不输出 Warn', () => {
    const l = new DefaultLogger();
    l.setLevel(LogLevel.Error);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    l.warn('test');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('Error 级别始终输出 Error', () => {
    const l = new DefaultLogger();
    l.setLevel(LogLevel.Error);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    l.error('test');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('NopLogger', () => {
  it('不输出任何内容', () => {
    const l = new NopLogger();
    // 不应抛出异常
    l.debug('test');
    l.info('test');
    l.warn('test');
    l.error('test');
    l.setLevel(LogLevel.Debug);
  });
});

describe('全局 Logger', () => {
  it('设置和获取全局 logger', () => {
    const original = getDefaultLogger();
    const nop = new NopLogger();
    setDefaultLogger(nop);
    expect(getDefaultLogger()).toBe(nop);
    setDefaultLogger(original);
  });
});
