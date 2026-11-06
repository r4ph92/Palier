import { describe, expect, it } from 'vitest';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = 'session-julie';
const JULIE_ID = 'driver-julie';

async function statusOf(scripted: ScriptedSql) {
  const repository = new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 });
  return repository.findForUser(SESSION_ID, JULIE_ID);
}

describe('the entry status of a session whose driver answered where the car is', () => {
  it('reads the answered spot before the assigned one', async () => {
    const scripted = new ScriptedSql();

    await statusOf(scripted);

    const [statement] = scripted.statements;
    expect(statement?.label).toBe('read-session-status');
    expect(statement?.text).toMatch(/join spot on spot\.id = coalesce\(ps\.confirmed_spot_id, ps\.assigned_spot_id\)/);
    expect(statement?.params).toEqual([SESSION_ID, JULIE_ID]);
  });

  it('serves the spot the read returned, B-3 for an answered session', async () => {
    const scripted = new ScriptedSql().answer('read-session-status', [
      { id: SESSION_ID, state: 'PARKED_CONFIRMED', entry_confirmed_at: '2026-11-04T23:00:00Z', number: 'B-3', aisle_code: 'B', level_code: 'P1' },
    ]);

    const status = await statusOf(scripted);

    expect(status).toMatchObject({ id: SESSION_ID, state: 'PARKED_CONFIRMED', spot: { number: 'B-3', aisleCode: 'B', levelCode: 'P1' } });
  });

  it('finds nothing for a session of another driver', async () => {
    expect(await statusOf(new ScriptedSql())).toBeNull();
  });
});
