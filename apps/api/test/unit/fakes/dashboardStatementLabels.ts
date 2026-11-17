// The statements of a lot's gates and of its publication, checked before the others: the checklist read also joins the operator.
export type DashboardStatementLabel =
  | 'read-publication-facts'
  | 'set-lot-online'
  | 'attest-lot'
  | 'read-gate-settings'
  | 'count-lot-gates'
  | 'insert-gate'
  | 'insert-device-key'
  | 'read-owned-gate-kind'
  | 'read-owned-gate-qr-secret'
  | 'change-gate'
  | 'revoke-device-keys'
  | 'replace-qr-secret'
  | 'forget-gate-controller'
  | 'read-session-lot-name'
  | 'list-sessions'
  | 'read-session'
  | 'read-session-events'
  | 'list-stale-sessions'
  | 'lock-session-to-confirm'
  | 'confirm-presence'
  | 'read-exit-counts';

export const DASHBOARD_STATEMENT_PATTERNS: readonly (readonly [DashboardStatementLabel, RegExp])[] = [
  ['read-publication-facts', /as in_service_spot_count/],
  ['set-lot-online', /update parking_lot set is_online/],
  ['attest-lot', /update parking_lot set (wifi|cell)_verified_at/],
  ['read-gate-settings', /gate\.integration_kind, gate\.endpoint/],
  ['count-lot-gates', /as exit_gate_count from gate/],
  ['insert-gate', /insert into gate \(lot_id/],
  ['insert-device-key', /insert into gate_device_key/],
  ['read-owned-gate-kind', /select gate\.kind from gate where gate\.id/],
  ['read-owned-gate-qr-secret', /select gate\.qr_secret from gate/],
  ['change-gate', /update gate set name =/],
  ['revoke-device-keys', /update gate_device_key set revoked_at/],
  ['replace-qr-secret', /update gate set qr_secret/],
  ['forget-gate-controller', /update gate set verified_at = null/],
  ['read-session-lot-name', /select parking_lot\.name as lot_name from parking_lot/],
  ['list-sessions', /order by ps\.entry_scan_at desc/],
  ['read-session', /as was_answered/],
  ['read-session-events', /from event_log\s+join parking_lot/],
  ['list-stale-sessions', /order by ps\.stale_flagged_at/],
  ['lock-session-to-confirm', /select stale_flagged_at is not null as flagged/],
  ['confirm-presence', /set presence_confirmed_at =/],
  ['read-exit-counts', /as exit_count/],
];
