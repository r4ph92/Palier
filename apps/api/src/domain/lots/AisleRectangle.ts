import type { AisleRectangle } from '@palier/shared-types';
import { isAisleRectangle } from '@palier/shared-types/aisleRectangle';

// absent: the operator has not drawn the aisle; rejected: the stored shape is unusable and worth a warning.
export type AisleRectangleReading =
  | { readonly kind: 'drawn'; readonly rectangle: AisleRectangle }
  | { readonly kind: 'absent' }
  | { readonly kind: 'rejected' };

const ABSENT: AisleRectangleReading = { kind: 'absent' };
const REJECTED: AisleRectangleReading = { kind: 'rejected' };

// aisle.map_polygon is untyped jsonb (decision 018): the read boundary turns it into a rectangle or says why not.
export function aisleRectangleOf(storedShape: unknown): AisleRectangleReading {
  if (storedShape === null || storedShape === undefined) {
    return ABSENT;
  }
  if (!isAisleRectangle(storedShape)) {
    return REJECTED;
  }
  const { x, y, width, height } = storedShape;
  return { kind: 'drawn', rectangle: { x, y, width, height } };
}
