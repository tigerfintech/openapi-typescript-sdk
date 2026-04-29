/**
 * Varint32 property-based tests (fast-check)
 *
 * Feature: protobuf-push-migration
 *
 * Property 1: Varint32 encode/decode round-trip
 * Property 2: Varint32 chunked decode
 * Property 3: Request message frame round-trip
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodeVarint32, decodeVarint32 } from '../../src/push/varint';
import { Request, Request_Connect, Request_Subscribe } from '../../src/push/pb/Request';
import { SocketCommon_Command, SocketCommon_DataType } from '../../src/push/pb/SocketCommon';

/**
 * Property 1: Varint32 encode/decode round-trip
 *
 * For any Uint8Array data (0..10000 bytes), encodeVarint32(data) then
 * decodeVarint32 should return the original data.
 *
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Property 1: Varint32 encode/decode round-trip', () => {
  it('should round-trip any byte array through encode then decode', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 10_000 }),
        (data) => {
          const encoded = encodeVarint32(data);
          const decoded = decodeVarint32(encoded);

          expect(decoded).not.toBeNull();
          expect(decoded!.message).toEqual(data);
          expect(decoded!.remaining.length).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 2: Varint32 chunked decode
 *
 * For any data, encode it, split at a random point — first decode returns null
 * (incomplete), concat both parts then decode succeeds.
 *
 * **Validates: Requirements 2.4**
 */
describe('Property 2: Varint32 chunked decode', () => {
  it('should handle chunked data: first chunk incomplete, full data decodes', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 5_000 }),
        fc.double({ min: 0.01, max: 0.99, noNaN: true }),
        (data, splitRatio) => {
          const encoded = encodeVarint32(data);

          // Split at a point that is guaranteed to be incomplete
          // (at least 1 byte before the end)
          const splitPoint = Math.max(1, Math.min(
            Math.floor(encoded.length * splitRatio),
            encoded.length - 1,
          ));

          const chunk1 = encoded.slice(0, splitPoint);
          const chunk2 = encoded.slice(splitPoint);

          // First chunk should be incomplete (return null)
          const partial = decodeVarint32(chunk1);
          expect(partial).toBeNull();

          // Full data should decode successfully
          const combined = new Uint8Array(chunk1.length + chunk2.length);
          combined.set(chunk1, 0);
          combined.set(chunk2, chunk1.length);

          const full = decodeVarint32(combined);
          expect(full).not.toBeNull();
          expect(full!.message).toEqual(data);
          expect(full!.remaining.length).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---- Generators for Property 3 ----

/** Generator for valid SocketCommon_Command values used in Request */
const arbCommand = fc.constantFrom(
  SocketCommon_Command.CONNECT,
  SocketCommon_Command.SUBSCRIBE,
  SocketCommon_Command.UNSUBSCRIBE,
  SocketCommon_Command.HEARTBEAT,
  SocketCommon_Command.DISCONNECT,
);

/** Generator for valid SocketCommon_DataType values */
const arbDataType = fc.constantFrom(
  SocketCommon_DataType.Quote,
  SocketCommon_DataType.Option,
  SocketCommon_DataType.Future,
  SocketCommon_DataType.QuoteDepth,
  SocketCommon_DataType.TradeTick,
  SocketCommon_DataType.Asset,
  SocketCommon_DataType.Position,
  SocketCommon_DataType.OrderStatus,
  SocketCommon_DataType.OrderTransaction,
  SocketCommon_DataType.StockTop,
  SocketCommon_DataType.OptionTop,
  SocketCommon_DataType.Kline,
);

/** Generator for a random Request message with appropriate sub-messages */
const arbRequest: fc.Arbitrary<Request> = arbCommand.chain((command) => {
  switch (command) {
    case SocketCommon_Command.CONNECT:
      return fc.record({
        tigerId: fc.string({ minLength: 1, maxLength: 50 }),
        sign: fc.string({ minLength: 1, maxLength: 100 }),
        sdkVersion: fc.string({ minLength: 1, maxLength: 30 }),
        acceptVersion: fc.string({ minLength: 1, maxLength: 10 }),
        sendInterval: fc.integer({ min: 1, max: 60_000 }),
        receiveInterval: fc.integer({ min: 1, max: 60_000 }),
        useFullTick: fc.boolean(),
      }).map((connect) =>
        Request.fromPartial({
          command,
          id: 1, // ID doesn't matter for round-trip; just needs to be valid
          connect: Request_Connect.fromPartial(connect),
        }),
      );

    case SocketCommon_Command.SUBSCRIBE:
    case SocketCommon_Command.UNSUBSCRIBE:
      return fc.record({
        dataType: arbDataType,
        symbols: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        account: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        market: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      }).map((subscribe) =>
        Request.fromPartial({
          command,
          id: 1,
          subscribe: Request_Subscribe.fromPartial(subscribe),
        }),
      );

    case SocketCommon_Command.HEARTBEAT:
    case SocketCommon_Command.DISCONNECT:
    default:
      return fc.constant(
        Request.fromPartial({ command, id: 1 }),
      );
  }
});

/**
 * Property 3: Request message frame round-trip
 *
 * For any valid Request (random command, fields), Request.encode().finish()
 * → encodeVarint32 → decodeVarint32 → Request.decode should produce an
 * equivalent Request.
 *
 * **Validates: Requirements 11.6, 12.4**
 */
describe('Property 3: Request message frame round-trip', () => {
  it('should round-trip any Request through protobuf + varint32 framing', () => {
    fc.assert(
      fc.property(arbRequest, (request) => {
        // Encode: Request → protobuf bytes → varint32 frame
        const protoBytes = Request.encode(request).finish();
        const framed = encodeVarint32(protoBytes);

        // Decode: varint32 frame → protobuf bytes → Request
        const decoded = decodeVarint32(framed);
        expect(decoded).not.toBeNull();
        expect(decoded!.remaining.length).toBe(0);

        const restored = Request.decode(decoded!.message);

        // Verify equivalence
        expect(restored.command).toBe(request.command);
        expect(restored.id).toBe(request.id);

        if (request.connect) {
          expect(restored.connect).toBeDefined();
          expect(restored.connect!.tigerId).toBe(request.connect.tigerId);
          expect(restored.connect!.sign).toBe(request.connect.sign);
          expect(restored.connect!.sdkVersion).toBe(request.connect.sdkVersion);
          expect(restored.connect!.acceptVersion).toBe(request.connect.acceptVersion);
          expect(restored.connect!.sendInterval).toBe(request.connect.sendInterval);
          expect(restored.connect!.receiveInterval).toBe(request.connect.receiveInterval);
          expect(restored.connect!.useFullTick).toBe(request.connect.useFullTick);
        } else {
          expect(restored.connect).toBeUndefined();
        }

        if (request.subscribe) {
          expect(restored.subscribe).toBeDefined();
          expect(restored.subscribe!.dataType).toBe(request.subscribe.dataType);
          expect(restored.subscribe!.symbols).toBe(request.subscribe.symbols);
          expect(restored.subscribe!.account).toBe(request.subscribe.account);
          expect(restored.subscribe!.market).toBe(request.subscribe.market);
        } else {
          expect(restored.subscribe).toBeUndefined();
        }
      }),
      { numRuns: 200 },
    );
  });
});
