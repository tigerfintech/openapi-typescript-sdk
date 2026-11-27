import { describe, expect, it, vi } from 'vitest';
import type { OptionExercisePosition } from '../../src/model/trade';
import { resolveExercisableOptionPosition } from '../integ/_helpers';

function page(items: OptionExercisePosition[]) {
  return { pageNum: 1, pageSize: 20, itemCount: items.length, pageCount: 1, items };
}

describe('Exercise integration test contract selection', () => {
  it('uses the exercise API and selects a position with sufficient available quantity', async () => {
    const eligible = { contractId: 123, symbol: 'AAPL', position: 3, availableQuantity: 2 };
    const tc = {
      getPositions: vi.fn().mockResolvedValue([{ contractId: 999, symbol: 'SPX', position: 1 }]),
      getOptionExercisePositions: vi.fn().mockResolvedValue(page([
        { contractId: 121, symbol: 'TSLA', position: -1, availableQuantity: -1 },
        { contractId: 122, symbol: 'NVDA', position: 1, availableQuantity: 0 },
        eligible,
      ])),
    };

    expect(await resolveExercisableOptionPosition(tc)).toEqual(eligible);
    expect(tc.getOptionExercisePositions).toHaveBeenCalledWith({ type: 'Exercise' });
    expect(tc.getPositions).not.toHaveBeenCalled();
  });

  it.each([
    { contractId: undefined, position: 1, availableQuantity: 1 },
    { contractId: 0, position: 1, availableQuantity: 1 },
    { contractId: NaN, position: 1, availableQuantity: 1 },
    { contractId: 123, position: 1, availableQuantity: 0 },
    { contractId: 123, position: -1, availableQuantity: -1 },
    { contractId: 123, position: 0.5, availableQuantity: 0.5 },
    { contractId: 123, position: 1, availableQuantity: NaN },
    { contractId: 123, position: 1, availableQuantity: Infinity },
  ])('rejects an unavailable position: %j', async position => {
    const tc = { getOptionExercisePositions: vi.fn().mockResolvedValue(page([position])) };
    expect(await resolveExercisableOptionPosition(tc)).toBeUndefined();
  });

  it.each([undefined, page([])])('returns no contract when no exercisable positions are returned', async response => {
    const tc = { getOptionExercisePositions: vi.fn().mockResolvedValue(response) };
    expect(await resolveExercisableOptionPosition(tc)).toBeUndefined();
  });

  it('propagates exercise-position query failures instead of treating them as an empty account', async () => {
    const error = new Error('gateway request failed');
    const tc = { getOptionExercisePositions: vi.fn().mockRejectedValue(error) };
    await expect(resolveExercisableOptionPosition(tc)).rejects.toBe(error);
  });
});
