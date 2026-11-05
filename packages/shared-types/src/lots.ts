export const SPOT_CATEGORIES = ['standard', 'electric', 'accessible', 'oversize'] as const;

export type SpotCategory = (typeof SPOT_CATEGORIES)[number];

export type SpotCountByCategory = Readonly<Record<SpotCategory, number>>;

export interface GeoPosition {
  readonly latitude: number;
  readonly longitude: number;
}

const LATITUDE_LIMIT_DEGREES = 90;
const LONGITUDE_LIMIT_DEGREES = 180;

export function isOnEarth({ latitude, longitude }: GeoPosition): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= LATITUDE_LIMIT_DEGREES &&
    Math.abs(longitude) <= LONGITUDE_LIMIT_DEGREES
  );
}

export interface LotSummary {
  readonly id: string;
  readonly name: string;
  readonly freeSpots: number;
  readonly freeSpotsByCategory: SpotCountByCategory;
  readonly location: GeoPosition | null;
}

export type LotListResponse = readonly LotSummary[];
