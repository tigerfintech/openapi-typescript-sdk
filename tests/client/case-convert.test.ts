/**
 * case-convert 工具函数测试
 *
 * 覆盖 camelToSnake 和 keysToSnakeCase 的全部行为分支。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { camelToSnake, keysToSnakeCase } from '../../src/client/case-convert';

describe('camelToSnake', () => {
  it('camelCase 转 snake_case（常见字段）', () => {
    expect(camelToSnake('camelCase')).toBe('camel_case');
    expect(camelToSnake('someFieldName')).toBe('some_field_name');
    expect(camelToSnake('totalQuantity')).toBe('total_quantity');
    expect(camelToSnake('secType')).toBe('sec_type');
    expect(camelToSnake('beginTime')).toBe('begin_time');
    expect(camelToSnake('limitPrice')).toBe('limit_price');
    expect(camelToSnake('timeInForce')).toBe('time_in_force');
  });

  it('已是 snake_case 的 key 不变（幂等性）', () => {
    expect(camelToSnake('snake_case')).toBe('snake_case');
    expect(camelToSnake('sec_type')).toBe('sec_type');
    expect(camelToSnake('begin_time')).toBe('begin_time');
    expect(camelToSnake('total_quantity')).toBe('total_quantity');
  });

  it('空字符串不变', () => {
    expect(camelToSnake('')).toBe('');
  });

  it('单字母大写转为 _小写', () => {
    expect(camelToSnake('aB')).toBe('a_b');
  });

  it('属性测试：转换后只含小写字母、数字、下划线', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
        (key) => {
          const result = camelToSnake(key);
          expect(result).toMatch(/^[a-z][a-z0-9_]*$/);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('属性测试：对纯 snake_case key 幂等', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z][a-z0-9_]*$/.test(s)),
        (key) => {
          expect(camelToSnake(key)).toBe(key);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('keysToSnakeCase', () => {
  it('顶层对象 key 转为 snake_case', () => {
    expect(keysToSnakeCase({ camelKey: 1, anotherKey: 'v' })).toEqual({
      camel_key: 1,
      another_key: 'v',
    });
  });

  it('嵌套对象递归转换', () => {
    expect(keysToSnakeCase({ outerKey: { innerKey: 42 } })).toEqual({
      outer_key: { inner_key: 42 },
    });
  });

  it('数组内对象元素递归转换', () => {
    expect(keysToSnakeCase([{ camelKey: 1 }, { otherKey: 2 }])).toEqual([
      { camel_key: 1 },
      { other_key: 2 },
    ]);
  });

  it('原始值直接返回', () => {
    expect(keysToSnakeCase('hello')).toBe('hello');
    expect(keysToSnakeCase(42)).toBe(42);
    expect(keysToSnakeCase(null)).toBeNull();
    expect(keysToSnakeCase(undefined)).toBeUndefined();
    expect(keysToSnakeCase(true)).toBe(true);
  });

  it('数组内原始值不变', () => {
    expect(keysToSnakeCase([1, 'two', null])).toEqual([1, 'two', null]);
  });

  it('空对象返回空对象', () => {
    expect(keysToSnakeCase({})).toEqual({});
  });

  it('已是 snake_case 的对象 key 不变', () => {
    expect(keysToSnakeCase({ sec_type: 'STK', begin_time: 0 })).toEqual({
      sec_type: 'STK',
      begin_time: 0,
    });
  });

  it('属性测试：转换后不含大写字母的 key', () => {
    fc.assert(
      fc.property(
        fc.record({
          someKey: fc.integer(),
          anotherValue: fc.string({ maxLength: 10 }),
        }),
        (obj) => {
          const result = keysToSnakeCase(obj) as Record<string, unknown>;
          for (const key of Object.keys(result)) {
            expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
