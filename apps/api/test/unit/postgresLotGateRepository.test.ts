import { describe, expect, it } from 'vitest';
import { MAX_GATES_PER_LOT, type GateDraft } from '@palier/shared-types/gateDraft';
import { PostgresGateSecretRepository } from '../../src/infrastructure/postgres/PostgresGateSecretRepository.ts';
import { PostgresLotGateRepository } from '../../src/infrastructure/postgres/PostgresLotGateRepository.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';

const ROY_OPERATOR = 'operator-roy';
const GARAGE_ROY_NORD = 'lot-roy-nord';
const GATE = 'gate-sortie';
const gatePlace = { lotId: GARAGE_ROY_NORD, gateId: GATE };
const sortieNord: GateDraft = { name: 'Sortie Nord', kind: 'EXIT', integrationKind: 'DRY_CONTACT', endpoint: null, reportsLoops: true, exitIdentification: 'PLATE' };
const newGate = { draft: sortieNord, qrSecret: 'qr-secret', deviceKeyHash: 'key-hash' };
const USABLE_SECRET = 'yyjpDWRCZm_vTBSRn1E5B9ExTvklzWnyhygcOQIFPiE';

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD }]);
}

describe('the gates of a lot in Postgres', () => {
  it('reads each gate’s settings, plate read back from the ANPR column, and never a secret', async () => {
    const scripted = new ScriptedSql().answer('read-gate-settings', [
      { lot_name: 'Garage Roy Nord', gate_id: GATE, gate_name: 'Sortie Nord', gate_kind: 'EXIT', integration_kind: 'DRY_CONTACT', endpoint: null, has_loops: true, exit_id_kind: 'ANPR' },
    ]);

    const gates = await new PostgresLotGateRepository(scripted.database()).readLotGates(ROY_OPERATOR, GARAGE_ROY_NORD);

    expect(gates).toEqual({ lotId: GARAGE_ROY_NORD, lotName: 'Garage Roy Nord', gates: [{ id: GATE, ...sortieNord }] });
    const { text, params } = scripted.statement('read-gate-settings') ?? { text: '', params: [] };
    expect(text).not.toMatch(/qr_secret|key_hash/);
    expect(text).toMatch(/where parking_lot\.id = \$1 and parking_lot\.operator_id = \$2\s+order by gate\.kind, gate\.name$/);
    expect(params).toEqual([GARAGE_ROY_NORD, ROY_OPERATOR]);
  });

  it('adds a gate after the lock: the limits are counted under it, then the gate and its key hash go in one transaction', async () => {
    const scripted = lockedLot().answer('count-lot-gates', [{ gate_count: 1, exit_gate_count: 0 }]).answer('insert-gate', [{ id: GATE }]);

    expect(await new PostgresLotGateRepository(scripted.database()).addGate(ROY_OPERATOR, GARAGE_ROY_NORD, newGate)).toEqual({ kind: 'written', gateId: GATE });

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'count-lot-gates', 'insert-gate', 'insert-device-key']);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.statement('insert-gate')?.params).toEqual([GARAGE_ROY_NORD, 'Sortie Nord', 'EXIT', 'DRY_CONTACT', null, true, 'ANPR', 'qr-secret']);
    expect(scripted.statement('insert-device-key')?.params).toEqual([GATE, 'key-hash']);
  });

  it.each([
    ['a second exit gate', { gate_count: 3, exit_gate_count: 1 }, 'GATE_EXIT_LIMIT'],
    [`a gate past ${MAX_GATES_PER_LOT}`, { gate_count: MAX_GATES_PER_LOT, exit_gate_count: 0 }, 'GATE_LIMIT_REACHED'],
  ])('refuses %s without inserting anything', async (_case, counted, reason) => {
    const scripted = lockedLot().answer('count-lot-gates', [counted]);

    expect(await new PostgresLotGateRepository(scripted.database()).addGate(ROY_OPERATOR, GARAGE_ROY_NORD, newGate)).toEqual({ kind: 'refused', reason });
    expect(scripted.count('insert-gate')).toBe(0);
  });

  it('reads a name the lot already has as GATE_NAME_TAKEN, and another operator’s lot as LOT_NOT_FOUND', async () => {
    const taken = lockedLot().answer('count-lot-gates', [{ gate_count: 0, exit_gate_count: 0 }]).fail('insert-gate', { code: '23505', constraint_name: 'gate_lot_id_name_unique' });

    expect(await new PostgresLotGateRepository(taken.database()).addGate(ROY_OPERATOR, GARAGE_ROY_NORD, newGate)).toEqual({ kind: 'refused', reason: 'GATE_NAME_TAKEN' });
    expect(await new PostgresLotGateRepository(new ScriptedSql().database()).addGate('operator-lavoie', GARAGE_ROY_NORD, newGate)).toEqual({ kind: 'refused', reason: 'LOT_NOT_FOUND' });
  });

  it('answers LOT_BUSY when the lock wait runs out', async () => {
    const scripted = new ScriptedSql().fail('lock-owned-lot', LOCK_NOT_AVAILABLE);

    expect(await new PostgresLotGateRepository(scripted.database()).addGate(ROY_OPERATOR, GARAGE_ROY_NORD, newGate)).toEqual({ kind: 'refused', reason: 'LOT_BUSY' });
  });

  it('changes a gate of the locked lot only, and refuses an exit identification on an entry gate', async () => {
    const exit = lockedLot().answer('read-owned-gate-kind', [{ kind: 'EXIT' }]);
    const entry = lockedLot().answer('read-owned-gate-kind', [{ kind: 'ENTRY' }]);

    expect(await new PostgresLotGateRepository(exit.database()).changeGate(ROY_OPERATOR, gatePlace, sortieNord)).toEqual({ kind: 'written', gateId: GATE });
    expect(exit.statement('change-gate')?.text).toMatch(/where gate\.id = \$\d+ and gate\.lot_id = \$\d+$/);
    expect(await new PostgresLotGateRepository(entry.database()).changeGate(ROY_OPERATOR, gatePlace, sortieNord)).toEqual({ kind: 'refused', reason: 'GATE_EXIT_ID_ON_ENTRY' });
    expect(entry.count('change-gate')).toBe(0);
  });

  it('clears the test passage when the wiring, the endpoint or the loops change, and keeps it for a new name', async () => {
    const scripted = lockedLot().answer('read-owned-gate-kind', [{ kind: 'EXIT' }]);

    await new PostgresLotGateRepository(scripted.database()).changeGate(ROY_OPERATOR, gatePlace, sortieNord);

    const { text, params } = scripted.statement('change-gate') ?? { text: '', params: [] };
    const reset = /verified_at = case\s+when integration_kind is distinct from \$(\d+)::gate_integration_kind or endpoint is distinct from \$(\d+)\s+or has_loops is distinct from \$(\d+) then null\s+else verified_at\s+end/.exec(text);
    const compared = (reset ?? []).slice(1).map((position) => params[Number(position) - 1]);
    expect(compared).toEqual(['DRY_CONTACT', null, true]);
    expect(text).not.toMatch(/name is distinct from/);
  });

  it('never reads the QR secret to change a gate', async () => {
    const scripted = lockedLot().answer('read-owned-gate-kind', [{ kind: 'EXIT' }]);

    await new PostgresLotGateRepository(scripted.database()).changeGate(ROY_OPERATOR, gatePlace, sortieNord);

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'read-owned-gate-kind', 'change-gate']);
    expect(scripted.statements.map(({ text }) => text).join('\n')).not.toMatch(/qr_secret/);
  });
});

describe('the secrets of a gate in Postgres', () => {
  it('revokes every live key of the gate and inserts the new hash, under the lot lock', async () => {
    const scripted = lockedLot().answer('read-owned-gate-kind', [{ kind: 'EXIT' }]);

    expect(await new PostgresGateSecretRepository(scripted.database()).replaceDeviceKey(ROY_OPERATOR, gatePlace, 'new-hash')).toEqual({ kind: 'written', gateId: GATE });

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'read-owned-gate-kind', 'revoke-device-keys', 'insert-device-key', 'forget-gate-controller']);
    expect(scripted.statements.map(({ text }) => text).join('\n')).not.toMatch(/qr_secret/);
    expect(scripted.statement('revoke-device-keys')?.text).toMatch(/gate_device_key\.gate_id = \$1 and gate_device_key\.revoked_at is null$/);
  });

  it('forgets the old controller with the new key: no heartbeat and no test passage until the new one sends them', async () => {
    const scripted = lockedLot().answer('read-owned-gate-kind', [{ kind: 'EXIT' }]);

    await new PostgresGateSecretRepository(scripted.database()).replaceDeviceKey(ROY_OPERATOR, gatePlace, 'new-hash');

    const statement = scripted.statement('forget-gate-controller');
    expect(statement?.text).toBe('update gate set verified_at = null, last_heartbeat_at = null where gate.id = $1 and gate.lot_id = $2');
    expect(statement?.params).toEqual([GATE, GARAGE_ROY_NORD]);
  });

  it('refuses a gate the locked lot does not hold as GATE_NOT_FOUND, revoking nothing', async () => {
    const scripted = lockedLot();

    expect(await new PostgresGateSecretRepository(scripted.database()).replaceDeviceKey(ROY_OPERATOR, gatePlace, 'new-hash')).toEqual({ kind: 'refused', reason: 'GATE_NOT_FOUND' });
    expect(scripted.count('revoke-device-keys')).toBe(0);
    expect(await new PostgresGateSecretRepository(lockedLot().database()).replaceQrSecret(ROY_OPERATOR, gatePlace, 'new')).toEqual({ kind: 'refused', reason: 'GATE_NOT_FOUND' });
  });

  it('reads a usable QR secret without writing, and stores the spare one only for a gate that has none', async () => {
    const usable = lockedLot().answer('read-owned-gate-qr-secret', [{ qr_secret: USABLE_SECRET }]);
    const missing = lockedLot().answer('read-owned-gate-qr-secret', [{ qr_secret: null }]).answer('replace-qr-secret', [{ id: GATE }]);

    expect(await new PostgresGateSecretRepository(usable.database()).usableQrSecret(ROY_OPERATOR, gatePlace, 'spare')).toEqual({ kind: 'secret', qrSecret: USABLE_SECRET });
    expect(usable.count('replace-qr-secret')).toBe(0);
    expect(await new PostgresGateSecretRepository(missing.database()).usableQrSecret(ROY_OPERATOR, gatePlace, 'spare')).toEqual({ kind: 'secret', qrSecret: 'spare' });
    expect(missing.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'read-owned-gate-qr-secret', 'replace-qr-secret']);
  });
});
