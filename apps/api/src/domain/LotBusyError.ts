export class LotBusyError extends Error {
  readonly lotId: string;

  constructor(lotId: string, options?: ErrorOptions) {
    super(`Lot ${lotId} stayed locked past the wait limit.`, options);
    this.name = 'LotBusyError';
    this.lotId = lotId;
  }
}
