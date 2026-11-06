import type { LevelPlan, PlanAisle } from '@palier/shared-types';
import { aisleRectangleOf } from './AisleRectangle.ts';

// An aisle of the assigned spot's level as stored, exit lanes already left out.
export interface StoredLevelAisle {
  readonly code: string;
  readonly beaconMinor: number;
  readonly mapPolygon: unknown;
}

export interface LevelPlanReading {
  readonly levelPlan: LevelPlan | null;
  // Aisles whose stored shape was unusable: they are served without a rectangle, and the caller logs them.
  readonly rejectedAisleCodes: readonly string[];
}

export function levelPlanOf(levelCode: string, storedAisles: readonly StoredLevelAisle[]): LevelPlanReading {
  if (storedAisles.length === 0) {
    return { levelPlan: null, rejectedAisleCodes: [] };
  }
  const rejectedAisleCodes: string[] = [];
  const aisles = storedAisles.map((stored) => {
    const reading = aisleRectangleOf(stored.mapPolygon);
    if (reading.kind === 'rejected') {
      rejectedAisleCodes.push(stored.code);
    }
    return planAisle(stored, reading.kind === 'drawn' ? reading.rectangle : null);
  });
  return { levelPlan: { levelCode, aisles }, rejectedAisleCodes };
}

function planAisle({ code, beaconMinor }: StoredLevelAisle, rectangle: PlanAisle['rectangle']): PlanAisle {
  return { code, beaconMinor, rectangle };
}
