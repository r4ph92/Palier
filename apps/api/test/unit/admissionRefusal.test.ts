import { describe, expect, it } from 'vitest';
import { EntryRefusedError } from '../../src/domain/entries/EntryRefusedError.ts';
import { LotBusyError } from '../../src/domain/lots/LotBusyError.ts';
import { admissionRefusalOf } from '../../src/infrastructure/postgres/admissionRefusal.ts';

const lockTimeout = { code: '55P03', message: 'canceling statement due to lock timeout' };

describe('admissionRefusalOf', () => {
  it('answers PAYMENTS_UNAVAILABLE, naming the busy lot, when the lot lock wait times out', () => {
    const refusal = admissionRefusalOf(new Error('Failed query', { cause: lockTimeout }), 'lot-demo');

    expect(refusal).toBeInstanceOf(EntryRefusedError);
    expect(refusal).toMatchObject({ reason: 'PAYMENTS_UNAVAILABLE', cause: expect.any(LotBusyError) });
    expect((refusal as EntryRefusedError).cause).toMatchObject({ lotId: 'lot-demo' });
  });

  it('answers ALREADY_INSIDE when a concurrent entry on another lot took the one active session first', () => {
    const conflict = { code: '23505', constraint_name: 'parking_session_one_active_per_user_index' };

    expect(admissionRefusalOf(conflict, 'lot-demo')).toMatchObject({ reason: 'ALREADY_INSIDE', cause: conflict });
  });

  it('passes any other error through unchanged', () => {
    const error = new Error('connection reset');

    expect(admissionRefusalOf(error, 'lot-demo')).toBe(error);
  });
});
