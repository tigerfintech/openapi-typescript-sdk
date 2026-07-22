/**
 * ConfigParser - Java properties 格式配置文件解析器
 *
 * 支持：
 * - key=value 键值对解析
 * - \ 续行（多行值）
 * - # 和 ! 注释行
 * - 空行忽略
 */
import * as fs from 'fs/promises';

/**
 * 解析 Java properties 格式的配置文件。
 * 异步读取文件内容后调用 parsePropertiesString 解析。
 *
 * @param filePath - 配置文件路径
 * @returns 键值对映射
 * @throws 文件不存在或读取失败时抛出错误
 */
export async function parsePropertiesFile(filePath: string): Promise<Record<string, string>> {
  const content = await fs.readFile(filePath, 'utf-8');
  return parsePropertiesString(content);
}

/**
 * 解析 Java properties 格式的字符串内容。
 *
 * @param content - properties 格式的字符串
 * @returns 键值对映射
 */
export function parsePropertiesString(content: string): Record<string, string> {
  const props: Record<string, string> = {};
  const lines = content.split('\n');

  let currentLine = '';
  let continuation = false;

  for (const rawLine of lines) {
    if (continuation) {
      // 续行：去除前导空格后拼接
      const trimmedLeft = rawLine.replace(/^[ \t]+/, '');
      if (trimmedLeft.endsWith('\\')) {
        currentLine += trimmedLeft.slice(0, -1);
        continue;
      }
      currentLine += trimmedLeft;
      continuation = false;
    } else {
      const trimmed = rawLine.trim();

      // 跳过空行
      if (trimmed === '') {
        continue;
      }

      // 跳过注释行
      if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
        continue;
      }

      // 检查续行
      if (trimmed.endsWith('\\')) {
        currentLine = trimmed.slice(0, -1);
        continuation = true;
        continue;
      }

      currentLine = trimmed;
    }

    // 解析键值对
    const result = parseKeyValue(currentLine);
    if (result) {
      props[result[0]] = result[1];
    }
    currentLine = '';
  }

  // 处理最后一行是续行但文件结束的情况
  if (continuation && currentLine !== '') {
    const result = parseKeyValue(currentLine);
    if (result) {
      props[result[0]] = result[1];
    }
  }

  return props;
}

/**
 * 解析单行键值对，支持 = 和 : 分隔符。
 * 值中可以包含 = 或 :，只按第一个分隔符拆分。
 *
 * @param line - 待解析的行
 * @returns [key, value] 元组，或 null（无效行）
 */
function parseKeyValue(line: string): [string, string] | null {
  const eqIdx = line.indexOf('=');
  const colonIdx = line.indexOf(':');

  let sepIdx = -1;
  if (eqIdx >= 0 && colonIdx >= 0) {
    sepIdx = Math.min(eqIdx, colonIdx);
  } else if (eqIdx >= 0) {
    sepIdx = eqIdx;
  } else if (colonIdx >= 0) {
    sepIdx = colonIdx;
  }

  if (sepIdx < 0) {
    return null;
  }

  const key = line.slice(0, sepIdx).trim();
  const value = line.slice(sepIdx + 1).trim();
  return key ? [key, value] : null;
}
