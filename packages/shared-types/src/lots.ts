export const SPOT_CATEGORIES = ['standard', 'electric', 'accessible', 'oversize'] as const;

export type SpotCategory = (typeof SPOT_CATEGORIES)[number];

export type SpotCountByCategory = Readonly<Record<SpotCategory, number>>;

export function countByCategory(countOf: (category: SpotCategory) => number): SpotCountByCategory {
  return Object.fromEntries(SPOT_CATEGORIES.map((category) => [category, countOf(category)])) as Record<SpotCategory, number>;
}

export interface GeoPosition {
  readonly latitude: number;
  readonly longitude: number;
}

const LATITUDE_LIMIT_DEGREES = 90;
const LONGITUDE_LIMIT_DEGREES = 180;

export function isLatitude(degrees: number): boolean {
  return Math.abs(degrees) <= LATITUDE_LIMIT_DEGREES;
}

export function isLongitude(degrees: number): boolean {
  return Math.abs(degrees) <= LONGITUDE_LIMIT_DEGREES;
}

export function isOnEarth({ latitude, longitude }: GeoPosition): boolean {
  return isLatitude(latitude) && isLongitude(longitude);
}

export interface LotSummary {
  readonly id: string;
  readonly name: string;
  readonly freeSpots: number;
  readonly freeSpotsByCategory: SpotCountByCategory;
  readonly location: GeoPosition | null;
}

export type LotListResponse = readonly LotSummary[];
