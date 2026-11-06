import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../src/api/VehicleClient';
import { parkedAnswerOutcomeOf } from '../src/parkingSessions/parkedAnswerOutcome';

describe('what a refused spot answer leads to (story #21)', () => {
  it.each([
    ['UNKNOWN_SPOT', 'UNKNOWN_SPOT'],
    ['SPOT_TAKEN', 'SPOT_TAKEN'],
    ['SPOT_OUT_OF_SERVICE', 'SPOT_OUT_OF_SERVICE'],
    ['Bad Request', 'INVALID_NUMBER'],
  ])('shows %s as %s', (code, problem) => {
    expect(parkedAnswerOutcomeOf(new PalierRejectedError(code))).toEqual({ kind: 'problem', problem });
  });

  it.each(['NOT_ASKED', 'SESSION_CLOSED', 'SESSION_NOT_FOUND'])('reads the session again for %s', (code) => {
    expect(parkedAnswerOutcomeOf(new PalierRejectedError(code))).toEqual({ kind: 'refresh' });
  });

  it.each([
    ['a lost connection', new PalierUnreachableError('offline')],
    ['a busy lot (503)', new PalierStatusError(503)],
  ])('says Palier cannot be reached after %s', (_case, error) => {
    expect(parkedAnswerOutcomeOf(error)).toEqual({ kind: 'problem', problem: 'UNREACHABLE' });
  });

  it.each([new PalierUnauthorizedError(), new PalierConsentRequiredError()])('stays silent for %p, which already left the tabs', (error) => {
    expect(parkedAnswerOutcomeOf(error)).toEqual({ kind: 'silent' });
  });

  it('logs an unexpected failure and says Palier cannot be reached', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(parkedAnswerOutcomeOf(new TypeError('boom'))).toEqual({ kind: 'problem', problem: 'UNREACHABLE' });
    expect(consoleError).toHaveBeenCalledWith('Answering where the car is parked failed', expect.any(TypeError));
    consoleError.mockRestore();
  });
});
