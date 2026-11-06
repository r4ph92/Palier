import type { AisleRectangle, LevelPlan, PlanAisle } from '@palier/shared-types';
import { asRecord } from './asRecord';
import { isNonNegativeInteger } from './isNonNegativeInteger';

// The plan only guides: anything unexpected reads as no plan, never as a session Palier could not read.
export function parseLevelPlan(candidate: unknown): LevelPlan | null {
  const { levelCode, aisles } = asRecord(candidate);
  if (typeof levelCode !== 'string' || !Array.isArray(aisles) || !aisles.every(isPlanAisle)) {
    return null;
  }
  return { levelCode, aisles: aisles.map(({ code, beaconMinor, rectangle }) => ({ code, beaconMinor, rectangle })) };
}

export function parseBeaconMajor(candidate: unknown): number | null {
  return isNonNegativeInteger(candidate) ? candidate : null;
}

function isPlanAisle(candidate: unknown): candidate is PlanAisle {
  const { code, beaconMinor, rectangle } = asRecord(candidate);
  return typeof code === 'string' && isNonNegativeInteger(beaconMinor) && (rectangle === null || isRectangle(rectangle));
}

function isRectangle(candidate: unknown): candidate is AisleRectangle {
  const { x, y, width, height } = asRecord(candidate);
  return [x, y].every(isPosition) && [width, height].every(isLength);
}

function isPosition(candidate: unknown): candidate is number {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0;
}

function isLength(candidate: unknown): candidate is number {
  return isPosition(candidate) && candidate > 0;
}
