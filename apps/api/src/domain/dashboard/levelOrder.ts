import type { LevelOrderRequest } from '@palier/shared-types';

// The page moves one level by one place, from the order it shows. An order sent from a page gone stale is refused whole,
// so a move another tab saved in the meantime is never undone without anyone seeing it.
export function isMoveOfCurrentOrder({ levelIds, fromLevelIds }: LevelOrderRequest, currentIds: readonly string[]): boolean {
  if (fromLevelIds !== undefined && !isSameOrder(fromLevelIds, currentIds)) {
    return false;
  }
  return isOneStepMove(levelIds, currentIds);
}

function isSameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

// The two orders differ by two neighbours swapped, and by nothing else.
function isOneStepMove(requested: readonly string[], current: readonly string[]): boolean {
  const changed = current.flatMap((id, index) => (requested[index] === id ? [] : [index]));
  if (requested.length !== current.length || changed.length !== 2) {
    return false;
  }
  const [first = 0, second = 0] = changed;
  return second === first + 1 && requested[first] === current[second] && requested[second] === current[first];
}
