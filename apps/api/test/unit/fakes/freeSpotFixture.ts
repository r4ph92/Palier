import type { FreeSpot } from '../../../src/domain/allocation/chooseSpot.ts';

// A standard free spot named like the seed's (« A-3 »): aisle from the prefix, five metres from the exit per position.
export function freeSpotFixture(number: string, overrides: Partial<FreeSpot> = {}): FreeSpot {
  const [aisleCode = '', position = '0'] = number.split('-');
  return {
    id: number,
    number,
    levelOrder: 1,
    aisleId: `aisle-${aisleCode}`,
    aisleCode,
    distanceToExit: Number(position) * 5,
    needsCheck: false,
    isEv: false,
    isAccessible: false,
    isOversize: false,
    ...overrides,
  };
}

// The row readFreeSpots maps back into this spot.
export function freeSpotRowOf(spot: FreeSpot) {
  return {
    id: spot.id,
    number: spot.number,
    level_order: spot.levelOrder,
    aisle_id: spot.aisleId,
    aisle_code: spot.aisleCode,
    distance_to_exit: spot.distanceToExit,
    needs_check: spot.needsCheck,
    is_ev: spot.isEv,
    is_accessible: spot.isAccessible,
    is_oversize: spot.isOversize,
  };
}
