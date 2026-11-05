// ACTIVE until the driver releases it (#7), it lapses (#8) or the driver enters with it (#9).
export const SPOT_HOLD_STATUSES = ['ACTIVE', 'RELEASED', 'EXPIRED', 'USED'] as const;

export type SpotHoldStatus = (typeof SPOT_HOLD_STATUSES)[number];

// The held spot's number is never sent: the hold guarantees the driver a place in the lot, not a spot number (D3, Q22).
export interface SpotHold {
  readonly spotHoldId: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly expiresAt: string;
  // The API's clock when it answered, so the app counts down from the server's time, not the phone's.
  readonly now: string;
}

export interface CurrentSpotHoldResponse {
  readonly spotHold: SpotHold | null;
}

export const SPOT_HOLD_REFUSAL_CODES = [
  'PREREQUISITES_MISSING',
  'HOLD_ALREADY_EXISTS',
  'HOLD_QUOTA_REACHED',
  'NO_SUITABLE_SPOT',
  'LOT_NOT_FOUND',
  'LOT_NOT_IN_SERVICE',
  'HOLD_UNAVAILABLE',
  'TOO_MANY_HOLD_ATTEMPTS',
] as const;

export type SpotHoldRefusalCode = (typeof SPOT_HOLD_REFUSAL_CODES)[number];

export interface SpotHoldRefusalBody {
  readonly statusCode: number;
  readonly error: SpotHoldRefusalCode;
  readonly message: string;
}
