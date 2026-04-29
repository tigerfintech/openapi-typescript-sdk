/**
 * Protobuf 消息构建器
 *
 * 对齐 Java SDK 的 ProtoMessageUtil，提供构建各种 Request 消息的工具函数。
 * 所有构建函数共享一个递增的 requestId 计数器。
 */

import {
  Request,
  Request_Connect,
  Request_Subscribe,
} from './pb/Request';
import {
  SocketCommon_Command,
  SocketCommon_DataType,
} from './pb/SocketCommon';
import { SubjectType } from './push-message';

/** 递增请求 ID 计数器（单线程环境，简单递增变量） */
let requestId = 0;

/**
 * 获取下一个请求 ID
 */
function nextRequestId(): number {
  requestId += 1;
  return requestId;
}

/**
 * 构建 CONNECT 请求消息
 */
export function buildConnectMessage(
  tigerId: string,
  sign: string,
  sdkVersion: string,
  acceptVersion: string,
  sendInterval: number,
  receiveInterval: number,
  useFullTick: boolean,
): Request {
  return Request.fromPartial({
    command: SocketCommon_Command.CONNECT,
    id: nextRequestId(),
    connect: Request_Connect.fromPartial({
      tigerId,
      sign,
      sdkVersion,
      acceptVersion,
      sendInterval,
      receiveInterval,
      useFullTick,
    }),
  });
}

/**
 * 构建 HEARTBEAT 请求消息
 */
export function buildHeartBeatMessage(): Request {
  return Request.fromPartial({
    command: SocketCommon_Command.HEARTBEAT,
    id: nextRequestId(),
  });
}

/**
 * 构建 SUBSCRIBE 请求消息
 */
export function buildSubscribeMessage(
  dataType: SocketCommon_DataType,
  symbols?: string,
  account?: string,
  market?: string,
): Request {
  return Request.fromPartial({
    command: SocketCommon_Command.SUBSCRIBE,
    id: nextRequestId(),
    subscribe: Request_Subscribe.fromPartial({
      dataType,
      symbols,
      account,
      market,
    }),
  });
}

/**
 * 构建 UNSUBSCRIBE 请求消息
 */
export function buildUnSubscribeMessage(
  dataType: SocketCommon_DataType,
  symbols?: string,
  account?: string,
  market?: string,
): Request {
  return Request.fromPartial({
    command: SocketCommon_Command.UNSUBSCRIBE,
    id: nextRequestId(),
    subscribe: Request_Subscribe.fromPartial({
      dataType,
      symbols,
      account,
      market,
    }),
  });
}

/**
 * 构建 DISCONNECT 请求消息
 */
export function buildDisconnectMessage(): Request {
  return Request.fromPartial({
    command: SocketCommon_Command.DISCONNECT,
    id: nextRequestId(),
  });
}

/**
 * 将 SubjectType 映射到 SocketCommon_DataType
 */
export function subjectToDataType(subject: SubjectType): SocketCommon_DataType {
  switch (subject) {
    case SubjectType.Quote:
      return SocketCommon_DataType.Quote;
    case SubjectType.Option:
      return SocketCommon_DataType.Option;
    case SubjectType.Future:
      return SocketCommon_DataType.Future;
    case SubjectType.Depth:
      return SocketCommon_DataType.QuoteDepth;
    case SubjectType.Tick:
      return SocketCommon_DataType.TradeTick;
    case SubjectType.Asset:
      return SocketCommon_DataType.Asset;
    case SubjectType.Position:
      return SocketCommon_DataType.Position;
    case SubjectType.Order:
      return SocketCommon_DataType.OrderStatus;
    case SubjectType.Transaction:
      return SocketCommon_DataType.OrderTransaction;
    case SubjectType.StockTop:
      return SocketCommon_DataType.StockTop;
    case SubjectType.OptionTop:
      return SocketCommon_DataType.OptionTop;
    case SubjectType.Kline:
      return SocketCommon_DataType.Kline;
    case SubjectType.FullTick:
      return SocketCommon_DataType.TradeTick;
    case SubjectType.QuoteBBO:
      return SocketCommon_DataType.Quote;
    default:
      return SocketCommon_DataType.Unknown;
  }
}
