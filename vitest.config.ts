import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integ/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Barrel/re-export files (no testable logic)
        'src/index.ts',
        'src/client/index.ts',
        'src/config/index.ts',
        'src/logger/index.ts',
        'src/push/index.ts',
        'src/push/pb/index.ts',
        'src/quote/index.ts',
        'src/signer/index.ts',
        'src/trade/index.ts',
        // Pure interface / type-only files (no runtime code to test)
        'src/model/contract.ts',
        'src/model/order.ts',
        'src/model/position.ts',
        'src/model/quote.ts',
        'src/model/quote-requests.ts',
        'src/model/trade-requests.ts',
        'src/model/trade.ts',
        'src/push/callbacks.ts',
      ],
    },
  },
});
