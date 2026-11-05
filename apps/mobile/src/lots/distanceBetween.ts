import type { GeoPosition } from '@palier/shared-types';

const EARTH_RADIUS_METRES = 6_371_000;
const DEGREES_PER_HALF_TURN = 180;

// Haversine: exact enough within 10 km, where the earth's flattening changes the distance by well under a metre.
export function distanceBetween(from: GeoPosition, to: GeoPosition): number {
  const latitudeChange = radians(to.latitude - from.latitude);
  const longitudeChange = radians(to.longitude - from.longitude);
  const halfChord =
    Math.sin(latitudeChange / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeChange / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(halfChord)));
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / DEGREES_PER_HALF_TURN;
}
