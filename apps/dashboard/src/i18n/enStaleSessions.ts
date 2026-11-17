import type { frStaleSessionErrors, frStaleSessions } from './frStaleSessions.ts';

export const enStaleSessions: typeof frStaleSessions = {
  title: 'Sessions with no exit',
  titleInLot: 'Sessions with no exit — %{lot}',
  back: 'Back to the parking lot',
  count: { one: '%{count} session with no exit', other: '%{count} sessions with no exit' },
  hint: 'No proof of presence and no exit for 7 days. Go and look on site, then confirm the vehicle is there: the session stays open and nothing is charged.',
  columns: { plate: 'Plate', spot: 'Spot', lastProof: 'Last proof', flagged: 'Flagged on', check: 'Check' },
  place: '%{level} · aisle %{aisle}',
  proofs: { ENTRY: 'Entry confirmed', PARKED_ON_FOOT: 'Reached the spot (on foot)', ANSWERED: 'Driver’s answer', PRESENCE: 'Presence confirmed' },
  present: { shown: 'Vehicle present', name: 'Vehicle present, %{plate}' },
  confirming: { shown: 'Confirming…', status: 'Confirming the presence of vehicle %{plate}…' },
  confirmed: 'Presence of vehicle %{plate} confirmed. The session stays open.',
  empty: 'No session with no exit.',
  emptyHint: 'A session appears here when a vehicle has had no proof of presence and no exit for 7 days.',
};

export const enStaleSessionErrors: typeof frStaleSessionErrors = { STALE_SESSION_GONE: 'The session of %{plate} is no longer open. The list was reloaded.' };
