import type { SpotHoldRefusalCode } from '@palier/shared-types';

const MESSAGES: Record<SpotHoldRefusalCode, string> = {
  PREREQUISITES_MISSING: 'Add a plate and a card before holding a spot.',
  HOLD_ALREADY_EXISTS: 'You already hold a spot.',
  HOLD_QUOTA_REACHED: 'Too many spots are held in this lot right now.',
  NO_SUITABLE_SPOT: 'No free spot fits this vehicle.',
  LOT_NOT_FOUND: 'No such lot.',
  LOT_NOT_IN_SERVICE: 'This lot is not in service.',
  HOLD_UNAVAILABLE: 'Spots cannot be held right now.',
  TOO_MANY_HOLD_ATTEMPTS: 'Too many attempts. Try again in a few minutes.',
  HOLD_NOT_FOUND: 'No such hold.',
  HOLD_EXPIRED: 'This guarantee has already expired.',
};

export const RELEASE_UNAVAILABLE_MESSAGE = 'The hold cannot be released right now.';

export interface SpotHoldRefusalOptions extends ErrorOptions {
  readonly message?: string;
}

export class SpotHoldRefusedError extends Error {
  readonly reason: SpotHoldRefusalCode;

  constructor(reason: SpotHoldRefusalCode, options?: SpotHoldRefusalOptions) {
    super(options?.message ?? MESSAGES[reason], options);
    this.name = 'SpotHoldRefusedError';
    this.reason = reason;
  }
}
