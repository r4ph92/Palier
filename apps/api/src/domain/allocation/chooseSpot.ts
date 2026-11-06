export interface FreeSpot {
  readonly id: string;
  readonly number: string;
  readonly levelOrder: number;
  readonly aisleId: string;
  readonly aisleCode: string;
  readonly distanceToExit: number;
  readonly needsCheck: boolean;
  readonly isEv: boolean;
  readonly isAccessible: boolean;
  readonly isOversize: boolean;
}

// First level with a free spot, then its aisle with the most free spots (lower code on a tie),
// then an unflagged spot nearest the exit; flagged spots only when nothing else is free in the aisle.
export function chooseSpot(freeSpots: readonly FreeSpot[]): FreeSpot | null {
  const firstLevel = Math.min(...freeSpots.map((spot) => spot.levelOrder));
  const inLevel = freeSpots.filter((spot) => spot.levelOrder === firstLevel);
  const aisleCode = [...inLevel].sort(
    (a, b) => freeCount(inLevel, b.aisleCode) - freeCount(inLevel, a.aisleCode) || compareText(a.aisleCode, b.aisleCode),
  )[0]?.aisleCode;
  const inAisle = inLevel.filter((spot) => spot.aisleCode === aisleCode);
  return (
    [...inAisle].sort(
      (a, b) =>
        Number(a.needsCheck) - Number(b.needsCheck) || a.distanceToExit - b.distanceToExit || compareText(a.number, b.number),
    )[0] ?? null
  );
}

function freeCount(spots: readonly FreeSpot[], aisleCode: string): number {
  return spots.filter((spot) => spot.aisleCode === aisleCode).length;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
