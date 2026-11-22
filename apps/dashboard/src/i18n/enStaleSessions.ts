import type { frStaleSessionErrors, frStaleSessions } from './frStaleSessions.ts';

export const enStaleSessions: typeof frStaleSessions = {
  title: 'Sessions with no exit',
  titleInLot: 'Sessions with no exit — %{lot}',
  back: 'Back to the parking lot',
  count: { one: '%{count} session with no exit', other: '%{count} sessions with no exit' },
  hint: 'No proof of presence and no exit for 7 days. Go and look on site. If the vehicle is there, confirm it: the session stays open. If the spot is empty, close the session at its last known proof: nothing is charged and the spot is to check.',
  columns: { plate: 'Plate', spot: 'Spot', lastProof: 'Last proof', flagged: 'Flagged on', check: 'Check' },
  place: '%{level} · aisle %{aisle}',
  proofs: { ENTRY: 'Entry confirmed', PARKED_ON_FOOT: 'Reached the spot (on foot)', ANSWERED: 'Driver’s answer', PRESENCE: 'Presence confirmed' },
  present: { shown: 'Vehicle present', name: 'Vehicle present, %{plate}' },
  confirming: { shown: 'Confirming…', status: 'Confirming the presence of vehicle %{plate}…' },
  confirmed: 'Presence of vehicle %{plate} confirmed. The session stays open.',
  close: { shown: 'Close at last known proof', name: 'Close at last known proof, %{plate}' },
  closeQuestion: 'Close the session of %{plate} at its last known proof, with no charge?',
  closeConfirm: { shown: 'Confirm', name: 'Confirm closing %{plate}' },
  closeCancel: 'Cancel',
  closing: { shown: 'Closing…', status: 'Closing the session of %{plate}…' },
  closed: 'Session of %{plate} closed at its last known proof. Nothing is charged and the spot is to check.',
  empty: 'No session with no exit.',
  emptyHint: 'A session appears here when a vehicle has had no proof of presence and no exit for 7 days.',
};

export const enStaleSessionErrors: typeof frStaleSessionErrors = { STALE_SESSION_GONE: 'The session of %{plate} is no longer open. The list was reloaded.' };
