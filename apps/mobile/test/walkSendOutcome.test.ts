import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../src/api/VehicleClient';
import { walkSendOutcome, type WalkSendOutcome } from '../src/parkingSessions/walkSendOutcome';

describe('what becomes of a walk Palier did not accept', () => {
  it.each<[string, unknown, WalkSendOutcome]>([
    ['a busy lot (503)', new PalierStatusError(503), 'keep'],
    ['a server error (500)', new PalierStatusError(500), 'keep'],
    ['an unreadable request (400)', new PalierStatusError(400), 'drop'],
    ['a status just under the server errors (499)', new PalierStatusError(499), 'drop'],
    ['no network', new PalierUnreachableError('offline'), 'keep'],
    ['a refused token', new PalierUnauthorizedError(), 'keep'],
    ['a missing privacy notice', new PalierConsentRequiredError(), 'keep'],
    ['a session of another driver (404)', new PalierRejectedError('SESSION_NOT_FOUND'), 'drop'],
    ['an entry not confirmed (409)', new PalierRejectedError('ENTRY_NOT_CONFIRMED'), 'drop'],
    ['a closed session (409)', new PalierRejectedError('SESSION_CLOSED'), 'drop'],
    ['a bug in the app', new TypeError('boom'), 'unexpected'],
  ])('%s gives %s', (_case, error, outcome) => {
    expect(walkSendOutcome(error)).toBe(outcome);
  });
});
