// One iBeacon region for the whole platform (Q40): every lot programs its beacons with this UUID, its own major and one minor per aisle.
// A fresh v4 UUID, not a beacon maker's factory default, so a beacon left unprogrammed is never read as a Palier aisle.
export const PLATFORM_BEACON_UUID = '7B8098B8-9525-4406-AB73-4ABD2095EDC3';

// The exit lane of every lot answers minor 0; the aisles drivers park in take 1 to 65 535.
export const EXIT_LANE_MINOR = 0;
export const AISLE_MINOR_LIMITS = { minimum: 1, maximum: 65_535 } as const;
