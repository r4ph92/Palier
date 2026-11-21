import { describe, expect, it } from 'vitest';
import { GATE_COMMAND_PAGE_SIZE } from '../../src/domain/gates/GateCommandFeed.ts';
import { PostgresGateCommandFeed } from '../../src/infrastructure/postgres/PostgresGateCommandFeed.ts';
import { storeOpenCommand } from '../../src/infrastructure/postgres/gateCommandStatements.ts';
import { entreeDemo } from './fakes/gateFixtures.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const SESSION_ID = '00000000-0000-4000-8000-000000000901';
const row = (sequence: number, issuedAt: string) => ({ id: `command-${sequence}`, kind: 'OPEN', issued_at: new Date(issuedAt), sequence });

describe('gate command feed in Postgres', () => {
  it("pages on the gate's sequence after the cursor, never on the issue time", async () => {
    const scripted = new ScriptedSql().answer('list-gate-commands-after', [row(8, '2026-10-27T22:02:30.000Z')]);

    const commands = await new PostgresGateCommandFeed(scripted.database()).listCommands(entreeDemo.id, 7);

    const statement = scripted.statement('list-gate-commands-after');
    expect(statement?.text).toMatch(/where gate_id = \$1 and sequence > \$2\s+order by sequence asc limit \$3$/);
    expect(statement?.text).not.toMatch(/issued_at\s*[<>]|order by issued_at/);
    expect(statement?.params).toEqual([entreeDemo.id, 7, GATE_COMMAND_PAGE_SIZE]);
    expect(commands).toEqual([{ id: 'command-8', kind: 'OPEN', issuedAt: '2026-10-27T22:02:30.000Z', sequence: 8 }]);
  });

  it('reads the latest page newest first and answers it oldest first', async () => {
    const scripted = new ScriptedSql().answer('list-latest-gate-commands', [row(3, '2026-10-27T22:04:00.000Z'), row(2, '2026-10-27T22:03:00.000Z')]);

    const commands = await new PostgresGateCommandFeed(scripted.database()).listCommands(entreeDemo.id, null);

    const statement = scripted.statement('list-latest-gate-commands');
    expect(statement?.text).toMatch(/where gate_id = \$1\s+order by sequence desc limit \$2$/);
    expect(statement?.params).toEqual([entreeDemo.id, GATE_COMMAND_PAGE_SIZE]);
    expect(commands.map((command) => command.sequence)).toEqual([2, 3]);
  });
});

describe('storing an opening command', () => {
  it("numbers the command by raising its gate's count in the same statement, so the gate's row lock orders commits", async () => {
    const scripted = new ScriptedSql().answer('insert-gate-command', [{ id: 'command-1' }]);

    await scripted.database().transaction((tx) => storeOpenCommand(tx, { gateId: entreeDemo.id, lotId: entreeDemo.lotId, sessionId: SESSION_ID }, 'ENTRY'));

    const statement = scripted.statement('insert-gate-command');
    expect(statement?.text).toMatch(
      /with counted as \(\s+update gate set last_command_sequence = last_command_sequence \+ 1\s+where id = \$1 and lot_id = \$2\s+returning last_command_sequence\)/,
    );
    expect(statement?.text).toMatch(/insert into gate_command \(gate_id, lot_id, kind, session_id, sequence\)\s+select \$3, \$4, 'OPEN', \$5, counted\.last_command_sequence from counted/);
    expect(statement?.params).toEqual([entreeDemo.id, entreeDemo.lotId, entreeDemo.id, entreeDemo.lotId, SESSION_ID]);
  });

  it('stores nothing and fails when the gate is not in the lot named', async () => {
    const scripted = new ScriptedSql().answer('insert-gate-command', []);

    await expect(
      scripted.database().transaction((tx) => storeOpenCommand(tx, { gateId: entreeDemo.id, lotId: 'another-lot', sessionId: SESSION_ID }, 'ENTRY')),
    ).rejects.toThrow('The gate command was not stored.');
    expect(scripted.labels()).toEqual(['insert-gate-command']);
  });
});
