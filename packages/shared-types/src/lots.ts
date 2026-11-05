export const SPOT_CATEGORIES = ['standard', 'electric', 'accessible', 'oversize'] as const;

export type SpotCategory = (typeof SPOT_CATEGORIES)[number];

export type SpotCountByCategory = Readonly<Record<SpotCategory, number>>;

export interface GeoPosition {
  readonly latitude: number;
  readonly longitude: number;
}

export interface LotSummary {
  readonly id: string;
  readonly name: string;
  readonly freeSpots: number;
  readonly freeSpotsByCategory: SpotCountByCategory;
  readonly location: GeoPosition | null;
}

export type LotListResponse = readonly LotSummary[];
