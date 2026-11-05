import { describe, expect, it } from 'vitest';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { EntryRefusedError } from '../../src/domain/entries/EntryRefusedError.ts';
import { LotBusyError } from '../../src/domain/lots/LotBusyError.ts';
import { PricingPolicyInvalidError } from '../../src/domain/pricing/PricingPolicy.ts';
import { handleEntryError } from '../../src/http/entries/handleEntryError.ts';
import { silentLog } from './fakes/entryFakes.ts';

function handle(error: Error) {
  const log = silentLog();
  const sent: unknown[] = [];
  const reply = { status: () => reply, send: (body: unknown) => sent.push(body) && reply } as unknown as FastifyReply;
  handleEntryError(error as FastifyError, { log } as unknown as FastifyRequest, reply);
  return { log, sent };
}

describe('handleEntryError', () => {
  it('logs a warning with the pricing error when a lot has no usable pricing policy', () => {
    const cause = new PricingPolicyInvalidError('lot-7');

    const { log, sent } = handle(new EntryRefusedError('LOT_NOT_IN_SERVICE', { cause }));

    expect(log.warnings).toEqual([[{ lotId: 'lot-7', err: cause }, 'entry refused: the lot has no usable pricing policy']]);
    expect(sent).toEqual([expect.objectContaining({ statusCode: 409, error: 'LOT_NOT_IN_SERVICE' })]);
  });

  it('logs the busy lot behind a PAYMENTS_UNAVAILABLE that came from a lock timeout', () => {
    const cause = new LotBusyError('lot-7');

    const { log, sent } = handle(new EntryRefusedError('PAYMENTS_UNAVAILABLE', { cause }));

    expect(log.warnings).toEqual([[{ lotId: 'lot-7', err: cause }, 'entry refused: the lot stayed locked past the lock timeout']]);
    expect(sent).toEqual([expect.objectContaining({ statusCode: 503, error: 'PAYMENTS_UNAVAILABLE' })]);
  });

  it('logs nothing for a lot that is simply offline', () => {
    const { log } = handle(new EntryRefusedError('LOT_NOT_IN_SERVICE'));

    expect(log.warnings).toHaveLength(0);
  });
});
