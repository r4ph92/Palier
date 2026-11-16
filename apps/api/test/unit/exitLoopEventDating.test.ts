import { describe, expect, it } from 'vitest';
import { PostgresPassageLedger } from '../../src/infrastructure/postgres/PostgresPassageLedger.ts';
import { onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { sortieDemo } from './fakes/gateFixtures.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000951';
// A gate controller whose clock was reset after a power loss reports the loop decades before the exit it answers.
const RESET_GATE_CLOCK = new Date('1971-01-01T00:00:00Z');
const WINDOW = { withinMilliseconds: 60_000 };

function closeExitLoopAt(scripted: ScriptedSql, closedAt: Date) {
  return new PostgresPassageLedger(scripted.database()).recordPassage({
    gate: sortieDemo,
    closedAt,
    vehicleCountChange: -1,
    confirmableOpenings: null,
    attachableOpenings: WINDOW,
  });
}

describe('an exit loop reported by a gate clock behind the database (QA #157, round 1)', () => {
  it('never dates the exit loop before the exit opening it closes, so its event is not born past its purge date', async () => {
    const scripted = new ScriptedSql().answer('count-vehicle', [{ vehicle_count: 0 }]).answer('attach-exit-passage', [{ id: SESSION_ID }]);

    await closeExitLoopAt(scripted, RESET_GATE_CLOCK);

    expect(onlyAppendedSessionEvent(scripted).occurredAtText).toMatch(/select "exit_passage_at" from parking_session/);
    expect(scripted.statement('attach-exit-passage')?.text).toMatch(/exit_passage_at = greatest\([\s\S]*issued_at/);
  });
});
