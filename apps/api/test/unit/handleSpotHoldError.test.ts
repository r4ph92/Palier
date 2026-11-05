import { describe, expect, it } from 'vitest';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { LotBusyError } from '../../src/domain/entries/LotBusyError.ts';
import { PricingPolicyInvalidError } from '../../src/domain/pricing/PricingPolicy.ts';
import { SpotHoldRefusedError } from '../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import { handleSpotHoldError } from '../../src/http/spotHolds/handleSpotHoldError.ts';
import { silentLog } from './fakes/entryFakes.ts';

function handle(error: Error) {
  const log = silentLog();
  const sent: unknown[] = [];
  const reply = { status: () => reply, send: (body: unknown) => sent.push(body) && reply } as unknown as FastifyReply;
  handleSpotHoldError(error as FastifyError, { log } as unknown as FastifyRequest, reply);
  return { log, sent };
}

describe('handleSpotHoldError', () => {
  it('logs the busy lot behind a HOLD_UNAVAILABLE that came from a lock timeout', () => {
    const cause = new LotBusyError('lot-7');

    const { log, sent } = handle(new SpotHoldRefusedError('HOLD_UNAVAILABLE', { cause }));

    expect(log.warnings).toEqual([[{ lotId: 'lot-7', err: cause }, 'spot hold refused: the lot stayed locked past the lock timeout']]);
    expect(sent).toEqual([{ statusCode: 503, error: 'HOLD_UNAVAILABLE', message: 'Spots cannot be held right now.' }]);
  });

  it('logs the pricing problem behind a LOT_NOT_IN_SERVICE', () => {
    const cause = new PricingPolicyInvalidError('lot-7');

    const { log } = handle(new SpotHoldRefusedError('LOT_NOT_IN_SERVICE', { cause }));

    expect(log.warnings).toEqual([[{ lotId: 'lot-7', err: cause }, 'spot hold refused: the lot has no usable pricing policy']]);
  });

  it('logs nothing for a refusal the driver caused', () => {
    expect(handle(new SpotHoldRefusedError('HOLD_ALREADY_EXISTS')).log.warnings).toHaveLength(0);
  });
});
