// Names each statement the repositories run by the text it matches, so a test scripts and inspects statements by label.
export type StatementLabel =
  | 'limit-lock-wait'
  | 'lock-lot'
  | 'read-active-session'
  | 'read-free-spots'
  | 'claim-spot'
  | 'insert-session'
  | 'read-active-spot-hold'
  | 'read-spot-hold-lot'
  | 'read-spot-hold-facts'
  | 'insert-spot-hold'
  | 'release-spot-hold'
  | 'find-expired-hold-lots'
  | 'expire-spot-holds'
  | 'read-held-spot'
  | 'use-spot-hold'
  | 'has-usable-spot-hold'
  | 'assign-held-spot'
  | 'free-held-spot'
  | 'find-silent-session-lots'
  | 'presume-silent-entries'
  | 'presume-silent-questions'
  | 'presume-parked'
  | 'read-unchanged-session'
  | 'read-walk-facts'
  | 'ask-where-parked'
  | 'flag-assigned-spot'
  | 'read-session-lot'
  | 'cancel-session'
  | 'restore-spot-hold'
  | 'lock-answering-session'
  | 'lock-reporting-session'
  | 'record-reported-spot'
  | 'reassign-spot'
  | 'lock-answered-spot'
  | 'occupy-answered-spot'
  | 'confirm-parked-spot'
  | 'read-current-session'
  | 'read-level-aisles'
  | 'read-parked-question'
  | 'read-session-status'
  | 'insert-lot'
  | 'update-lot-pricing'
  | 'read-lot-details'
  | 'read-lot-occupancy'
  | 'read-level-occupancy'
  | 'lock-owned-lot'
  | 'read-lot-map'
  | 'insert-level'
  | 'insert-exit-lane'
  | 'read-level-ids'
  | 'reorder-levels'
  | 'insert-aisle'
  | 'read-aisle-spots'
  | 'read-parking-aisle'
  | 'count-live-spots'
  | 'find-taken-number'
  | 'insert-spots'
  | 'change-spot'
  | 'delete-unused-spot'
  | 'retire-spot'
  | 'read-live-spot'
  | 'replay-passages'
  | 'record-heartbeat'
  | 'record-reported-battery'
  | 'read-lot-gates'
  | 'read-owned-lot-id'
  | 'record-aisle-battery'
  | 'unknown';

// Checked in order: the claim also tests state = 'AVAILABLE', so it must match before the free-spot read.
const STATEMENT_PATTERNS: readonly (readonly [StatementLabel, RegExp])[] = [
  ['limit-lock-wait', /set local lock_timeout/],
  ['insert-lot', /insert into parking_lot/],
  ['lock-owned-lot', /from parking_lot where id = \$1 and operator_id = \$2 for no key update/],
  ['read-lot-map', /aisle\.is_exit_lane, aisle\.map_polygon/],
  ['insert-level', /insert into level/],
  ['insert-exit-lane', /insert into aisle \(level_id, lot_id, code, beacon_minor, is_exit_lane\)/],
  ['read-level-ids', /select level\.id from level/],
  ['reorder-levels', /update level set display_order/],
  ['insert-aisle', /insert into aisle \(level_id, lot_id, code, beacon_minor, map_polygon\)/],
  ['read-aisle-spots', /lot_spots\.spot_count,\s+spot\.id/],
  ['read-parking-aisle', /select aisle\.id from aisle cross join parking_lot/],
  ['count-live-spots', /\) as spot_count from parking_lot where/],
  ['find-taken-number', /with ordinality as wanted/],
  ['insert-spots', /insert into spot \(/],
  ['change-spot', /update spot set is_ev/],
  ['delete-unused-spot', /delete from spot using parking_lot/],
  ['retire-spot', /update spot set retired_at/],
  ['read-live-spot', /select spot\.id from spot cross join parking_lot/],
  ['update-lot-pricing', /update parking_lot\s+set pricing_policy/],
  ['read-lot-details', /from parking_lot where id = \$1 and operator_id = \$2/],
  ['read-level-occupancy', /as confirmed_assigned_count/],
  ['replay-passages', /insert into gate_passage[\s\S]*on conflict/],
  ['record-heartbeat', /update gate set last_heartbeat_at/],
  ['read-owned-lot-id', /select parking_lot\.id from parking_lot where parking_lot\.id = \$1 and parking_lot\.operator_id = \$2/],
  ['record-aisle-battery', /update aisle set beacon_battery_percent[\s\S]*from parking_lot/],
  ['read-lot-gates', /gate\.last_heartbeat_at\s+from parking_lot/],
  ['record-reported-battery', /where lot_id = \$\d and beacon_minor = \$\d/],
  ['find-silent-session-lots', /select distinct lot_id from parking_session/],
  ['presume-silent-entries', /where lot_id = \$\d and state = 'ENTRY_CONFIRMED' and entry_confirmed_at/],
  ['presume-silent-questions', /where lot_id = \$\d and state = 'PARKED_UNCONFIRMED' and parked_at/],
  ['presume-parked', /set state = 'PARKED_PRESUMED'/],
  ['read-walk-facts', /left join aisle detected/],
  ['ask-where-parked', /set state = 'PARKED_UNCONFIRMED'/],
  ['flag-assigned-spot', /set state = 'OCCUPIED_UNKNOWN'/],
  ['cancel-session', /set state = 'CANCELLED'/],
  ['restore-spot-hold', /update spot_hold set status = 'ACTIVE'/],
  ['read-session-lot', /select lot_id from parking_session/],
  ['lock-reporting-session', /left join vehicle[\s\S]*for update of ps/],
  ['lock-answering-session', /for update of ps/],
  ['record-reported-spot', /insert into parking_session_reported_spot/],
  ['reassign-spot', /update parking_session set assigned_spot_id/],
  ['lock-answered-spot', /for update of spot/],
  ['occupy-answered-spot', /set state = 'OCCUPIED', needs_check = false/],
  ['confirm-parked-spot', /set state = 'PARKED_CONFIRMED'/],
  ['read-current-session', /from \(select \* from parking_session/],
  ['read-level-aisles', /from aisle\s+where level_id/],
  ['read-parked-question', /left join spot on spot\.aisle_id = aisle\.id/],
  ['read-session-status', /select ps\.id, ps\.state, ps\.entry_confirmed_at/],
  ['read-unchanged-session', /select state, parked_at from parking_session/],
  ['lock-lot', /from parking_lot[\s\S]*for no key update/],
  ['read-lot-occupancy', /as assigned_spot_count\s+from parking_lot/],
  ['read-active-session', /with active as/],
  ['assign-held-spot', /state = 'HELD' for update skip locked/],
  ['claim-spot', /for update skip locked/],
  ['read-free-spots', /s\.state = 'AVAILABLE'/],
  ['read-active-spot-hold', /from \(select id, lot_id, expires_at from spot_hold/],
  ['read-spot-hold-lot', /join operator on/],
  ['read-spot-hold-facts', /as active_holds_in_lot/],
  ['insert-spot-hold', /insert into spot_hold/],
  ['release-spot-hold', /update spot_hold set status = 'RELEASED'/],
  ['find-expired-hold-lots', /select distinct lot_id from spot_hold/],
  ['expire-spot-holds', /update spot_hold set status = 'EXPIRED'/],
  ['use-spot-hold', /update spot_hold set status = 'USED'/],
  ['read-held-spot', /from \(select id, spot_id from spot_hold/],
  ['has-usable-spot-hold', /select 1 from spot_hold/],
  ['free-held-spot', /update spot set/],
];

export function labelOf(text: string): StatementLabel {
  return STATEMENT_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'unknown';
}
