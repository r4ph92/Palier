import type { frSpotsToCheck } from './frSpotsToCheck.ts';

export const enSpotsToCheck: typeof frSpotsToCheck = {
  title: 'Spots to check',
  titleInLot: 'Spots to check — %{lot}',
  count: { one: '%{count} spot to check', other: '%{count} spots to check' },
  back: 'Back to the parking lot',
  hint: 'Go and look on site, then mark the spot as checked: it will be assigned normally again.',
  spotColumn: 'Spot',
  placeColumn: 'Level and aisle',
  stateColumn: 'State',
  heldBySession: 'Held by a session',
  sinceColumn: 'Since',
  reasonColumn: 'Reason',
  checkColumn: 'Check',
  place: '%{level} · aisle\u00a0%{aisle}',
  reasons: { WRONG_AISLE: 'different aisle', WRONG_SPOT: 'another spot in the aisle', REPORTED_TAKEN: 'spot reported taken', NOT_RECORDED: 'reason not recorded' },
  checked: { shown: 'Checked', name: 'Spot %{number} checked' },
  cleared: 'Spot %{number} checked.',
  empty: 'No spot to check.',
  emptyHint: 'A spot appears here when a driver parked somewhere other than planned, or reported it taken.',
};
