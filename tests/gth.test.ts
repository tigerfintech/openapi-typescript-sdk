import { describe, it, expect, vi } from 'vitest';
import { QuoteBasicData } from '../src/push/pb/QuoteBasicData';
import { QuoteData } from '../src/push/pb/QuoteData';
import { QuoteClient } from '../src/quote/quote-client';
import type { HttpClient } from '../src/client/http-client';
import type { OptionHourTrading } from '../src';

describe('GTH option quotes', () => {
  // Fixtures generated from stock-openapi feat_gth commit 33df7142f.
  it.each([
    ['0a185350585720323032363037323320373338302e3020505554100118a4fb9df1f83331000000000000f83f3889fa9df1f833499a9999999999f13f500e5900000000000029407a095072654d61726b6574e9010000000000001c40f001d00ff901000000008087c340820203475448', 1.5, 1784796380425, 7, 12.5],
    ['0a185350585720323032363037323320373338302e3020505554100118a4fb9df1f8333100000000000000003800499a9999999999f13f50005900000000000000007a095072654d61726b6574e9010000000000000000f001d00ff901000000008087c340820203475448', 0, 0, 0, 0],
  ] as const)('decodes flat server fields and preserves explicit zeros', (hex, price, time, volume, amount) => {
    const wire = Buffer.from(hex, 'hex');
    for (const q of [QuoteData.decode(wire), QuoteBasicData.decode(wire)]) {
      expect(q).toMatchObject({
        latestPrice: price, latestPriceTimestamp: time, preClose: 1.1,
        volume, volumeDecimal: volume, amount, cumVolume: 1000, cumAmount: 9999,
        session: 'GTH', hourTradingTag: 'PreMarket',
      });
      expect(q).not.toHaveProperty('hourTrading');
      expect(JSON.parse(JSON.stringify(q))).not.toHaveProperty('hourTrading');
    }
  });

  it('keeps missing trade fields and session absent', () => {
    for (const q of [QuoteData.decode(Uint8Array.of(0x10, 0x01)),
                     QuoteBasicData.decode(Uint8Array.of(0x10, 0x01))]) {
      for (const field of ['latestPrice', 'latestPriceTimestamp', 'volume', 'volumeDecimal',
                           'amount', 'cumVolume', 'cumAmount', 'session', 'hourTradingTag']) {
        expect(q[field as keyof typeof q]).toBeUndefined();
      }
    }
    const publicType: OptionHourTrading = { session: 'GTH', volume: 0 };
    expect(publicType).toEqual({ session: 'GTH', volume: 0 });
  });

  it.each([undefined, true, false])('sends the minute-bar flag %s on every query', async (flag) => {
    const http = { executeRequest: vi.fn().mockResolvedValue({ code: 0, message: '', data: [] }) } as unknown as HttpClient;
    const client = new QuoteClient(http);
    await client.getOptionKline(['SPXW  260723P07380000', 'SPXW  260723C07380000'],
      '5min', -1, -1, undefined, 20, 'desc', flag);
    const body = JSON.parse(vi.mocked(http.executeRequest).mock.calls[0][0].bizContent);
    expect(body.option_query).toHaveLength(2);
    for (const query of body.option_query) {
      if (flag === undefined) expect(query).not.toHaveProperty('with_hour_trading');
      else expect(query.with_hour_trading).toBe(flag);
    }
  });
});
