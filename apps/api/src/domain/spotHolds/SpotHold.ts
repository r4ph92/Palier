// The held spot stays inside the repository: the driver is guaranteed a place in the lot, not a spot number (D3, Q22).
export interface SpotHold {
  readonly id: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly expiresAt: Date;
}
