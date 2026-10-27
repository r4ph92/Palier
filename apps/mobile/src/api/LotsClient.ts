import type { LotListResponse } from '@palier/shared-types';

export interface LotsClient {
  listLots(): Promise<LotListResponse>;
}

export class PalierUnreachableError extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(`Palier API unreachable: ${reason}`, options);
    this.name = 'PalierUnreachableError';
  }
}

export class PalierStatusError extends PalierUnreachableError {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'PalierStatusError';
    this.status = status;
  }
}
