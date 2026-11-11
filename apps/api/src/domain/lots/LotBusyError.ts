// Kept as the cause of a PAYMENTS_UNAVAILABLE or HOLD_UNAVAILABLE refusal, or logged as a warning by the periodic jobs, so the log tells a lot under contention from another failure.
export class LotBusyError extends Error {
  readonly lotId: string;

  constructor(lotId: string, options?: ErrorOptions) {
    super(`Parking lot ${lotId} stayed locked past the lot lock timeout.`, options);
    this.name = 'LotBusyError';
    this.lotId = lotId;
  }
}
