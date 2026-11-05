import { describe, expect, it } from 'vitest';
import { EntryRefusedError } from '../../src/domain/entries/EntryRefusedError.ts';
import { LotBusyError } from '../../src/domain/entries/LotBusyError.ts';
import { SpotHoldRefusedError } from '../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import { spotHoldRefusalOf } from '../../src/infrastructure/postgres/spotHoldRefusal.ts';

describe('spotHoldRefusalOf', () => {
  it('answers HOLD_ALREADY_EXISTS when the same driver\'s hold in another lot took the one active hold first', () => {
    const conflict = { code: '23505', constraint_name: 'spot_hold_one_active_per_user_index' };

    expect(spotHoldRefusalOf(new Error('Failed query', { cause: conflict }), 'lot-demo')).toMatchObject({ reason: 'HOLD_ALREADY_EXISTS' });
  });

  it('answers the retryable HOLD_UNAVAILABLE when another hold took the same spot', () => {
    const conflict = { code: '23505', constraint_name: 'spot_hold_one_active_per_spot_index' };

    expect(spotHoldRefusalOf(conflict, 'lot-demo')).toMatchObject({ reason: 'HOLD_UNAVAILABLE', cause: conflict });
  });

  it('answers HOLD_UNAVAILABLE, naming the busy lot, when the lot lock wait times out', () => {
    const refusal = spotHoldRefusalOf(new Error('Failed query', { cause: { code: '55P03' } }), 'lot-demo');

    expect(refusal).toBeInstanceOf(SpotHoldRefusedError);
    expect(refusal).toMatchObject({ reason: 'HOLD_UNAVAILABLE', cause: expect.any(LotBusyError) });
    expect((refusal as SpotHoldRefusedError).cause).toMatchObject({ lotId: 'lot-demo' });
  });

  it('answers its own NO_SUITABLE_SPOT when the allocation finds free spots but none that fits', () => {
    const refusal = spotHoldRefusalOf(new EntryRefusedError('NO_SUITABLE_SPOT'), 'lot-demo');

    expect(refusal).toBeInstanceOf(SpotHoldRefusedError);
    expect(refusal).toMatchObject({ reason: 'NO_SUITABLE_SPOT' });
  });

  it.each([
    ['another entry refusal', new EntryRefusedError('LOT_FULL')],
    ['another unique violation', { code: '23505', constraint_name: 'parking_session_one_active_per_user_index' }],
    ['a broken connection', new Error('connection reset')],
  ])('passes %s through unchanged', (_case, error) => {
    expect(spotHoldRefusalOf(error, 'lot-demo')).toBe(error);
  });
});
