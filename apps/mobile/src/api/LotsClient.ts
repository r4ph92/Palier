import type { LotListResponse } from '@palier/shared-types';

export interface LotsClient {
  listLots(): Promise<LotListResponse>;
}

export class PalierUnreachableError extends Error {
  constructor(reason: string) {
    super(`Palier API unreachable: ${reason}`);
    this.name = 'PalierUnreachableError';
  }
}
