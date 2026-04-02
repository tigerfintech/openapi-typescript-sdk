/**
 * 错误类型定义模块
 *
 * 定义 TigerError 及错误码分类逻辑。
 */

/** 错误分类 */
export type ErrorCategory =
  | 'success'
  | 'common_param_error'
  | 'biz_param_error'
  | 'rate_limit'
  | 'trade_global_error'
  | 'trade_prime_error'
  | 'trade_simulation_error'
  | 'quote_stock_error'
  | 'quote_option_error'
  | 'quote_future_error'
  | 'token_error'
  | 'permission_error'
  | 'server_error'
  | 'unknown_error';

/**
 * 根据错误码返回对应的错误分类
 */
export function classifyErrorCode(code: number): ErrorCategory {
  if (code === 0) return 'success';
  if (code === 5) return 'rate_limit';
  if (code >= 1000 && code < 1010) return 'common_param_error';
  if (code >= 1010 && code < 1100) return 'biz_param_error';
  if (code >= 1100 && code < 1200) return 'trade_global_error';
  if (code >= 1200 && code < 1300) return 'trade_prime_error';
  if (code >= 1300 && code < 2100) return 'trade_simulation_error';
  if (code >= 2100 && code < 2200) return 'quote_stock_error';
  if (code >= 2200 && code < 2300) return 'quote_option_error';
  if (code >= 2300 && code < 2400) return 'quote_future_error';
  if (code >= 2400 && code < 4000) return 'token_error';
  if (code >= 4000 && code < 5000) return 'permission_error';
  return 'unknown_error';
}

/**
 * TigerError - 统一错误类型
 */
export class TigerError extends Error {
  code: number;
  category: ErrorCategory;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'TigerError';
    this.code = code;
    this.category = classifyErrorCode(code);
  }
}
