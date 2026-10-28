export interface LotSummary {
  readonly id: string;
  readonly name: string;
  readonly freeSpots: number;
}

export type LotListResponse = readonly LotSummary[];
