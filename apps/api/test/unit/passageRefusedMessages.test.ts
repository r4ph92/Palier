import { describe, expect, it } from 'vitest';
import { PassageRefusedError } from '../../src/domain/gates/PassageRefusedError.ts';
import { ALLOWED_CLOCK_DRIFT_MINUTES, MAXIMUM_REPLAY_AGE_DAYS } from '../../src/domain/gates/passageWindow.ts';

describe('the messages of a refused passage', () => {
  it('name the clock drift the rules allow', () => {
    expect(new PassageRefusedError('CLOSED_AT_IN_FUTURE').message).toContain(`${ALLOWED_CLOCK_DRIFT_MINUTES} minutes`);
  });

  it('name the replay age the rules allow', () => {
    expect(new PassageRefusedError('CLOSED_AT_TOO_OLD').message).toContain(`${MAXIMUM_REPLAY_AGE_DAYS} days`);
  });
});
