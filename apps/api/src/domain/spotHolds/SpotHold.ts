// The held spot stays inside the repository: the driver is guaranteed a place in the lot, not a spot number (D3, Q22).
export interface SpotHold {
  readonly id: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly expiresAt: Date;
}

// From its expiry instant a hold is over: release refuses it and entry cannot use it (SQL: spotHoldEndedAt).
export function hasSpotHoldEnded(spotHold: Pick<SpotHold, 'expiresAt'>, now: Date): boolean {
  return spotHold.expiresAt <= now;
}
