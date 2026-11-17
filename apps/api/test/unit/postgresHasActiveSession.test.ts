import { describe, expect, it } from 'vitest';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = 'driver-julie';

function repositoryOver(scripted: ScriptedSql): PostgresParkingSessionRepository {
  return new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 }, () => new Date());
}

describe('PostgresParkingSessionRepository.hasActiveSession', () => {
  it('asks for the driver\'s own session in every active state and in no closed one', async () => {
    const scripted = new ScriptedSql();

    await repositoryOver(scripted).hasActiveSession(JULIE_ID);

    const statement = scripted.statement('read-driver-active-session');
    expect(statement?.params).toEqual([JULIE_ID]);
    for (const activeState of ACTIVE_ENTRY_SESSION_STATES) expect(statement?.text).toContain(`'${activeState}'`);
    for (const closedState of ['CANCELLED', 'CLOSED_PAID', 'CLOSED_CAPTURE_PENDING']) expect(statement?.text).not.toContain(`'${closedState}'`);
  });

  it('is true when a session row answers and false when none does', async () => {
    const inside = repositoryOver(new ScriptedSql().answer('read-driver-active-session', [{ '?column?': 1 }]));
    const outside = repositoryOver(new ScriptedSql());

    expect(await inside.hasActiveSession(JULIE_ID)).toBe(true);
    expect(await outside.hasActiveSession(JULIE_ID)).toBe(false);
  });
});
