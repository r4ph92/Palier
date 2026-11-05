// Kept as the cause of a PAYMENTS_UNAVAILABLE refusal, so the log tells a lot under contention from a Stripe failure.
export class LotBusyError extends Error {
  readonly lotId: string;

  constructor(lotId: string, options?: ErrorOptions) {
    super(`Parking lot ${lotId} stayed locked past the entry lock timeout.`, options);
    this.name = 'LotBusyError';
    this.lotId = lotId;
  }
}
