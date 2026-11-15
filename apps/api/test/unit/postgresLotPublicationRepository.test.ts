import { describe, expect, it } from 'vitest';
import { PostgresLotPublicationRepository } from '../../src/infrastructure/postgres/PostgresLotPublicationRepository.ts';
import { LOCK_NOT_AVAILABLE, ScriptedSql } from './fakes/scriptedSql.ts';
import { GARAGE_ROY_NORD_ID, readyGarageRoyNord } from './fakes/publicationFixtures.ts';
import { readyGarageRoyNordRow } from './fakes/publicationRows.ts';

const ROY_OPERATOR = 'operator-roy';
const NOW = new Date('2026-11-15T14:00:00Z');

function lockedLot(): ScriptedSql {
  return new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD_ID }]);
}

function repositoryOn(scripted: ScriptedSql): PostgresLotPublicationRepository {
  return new PostgresLotPublicationRepository(scripted.database());
}

describe('the publication of a lot in Postgres', () => {
  it('reads the whole checklist in one statement scoped to the operator, gates’ instants in UTC', async () => {
    const scripted = new ScriptedSql().answer('read-publication-facts', [readyGarageRoyNordRow()]);

    const facts = await repositoryOn(scripted).readPublicationFacts(ROY_OPERATOR, GARAGE_ROY_NORD_ID);

    expect(facts).toEqual(readyGarageRoyNord());
    const { text, params } = scripted.statement('read-publication-facts') ?? { text: '', params: [] };
    expect(text).toMatch(/where parking_lot\.id = \$\d+ and parking_lot\.operator_id = \$\d+$/);
    expect(text).toContain("spot.retired_at is null and spot.state <> 'OUT_OF_SERVICE'");
    expect(params.slice(-2)).toEqual([GARAGE_ROY_NORD_ID, ROY_OPERATOR]);
    expect(params).toContain('America/Toronto');
  });

  it('reads another operator’s lot as none', async () => {
    expect(await repositoryOn(new ScriptedSql()).readPublicationFacts(ROY_OPERATOR, GARAGE_ROY_NORD_ID)).toBeNull();
  });

  it('reads a day without its note as not attested', async () => {
    const scripted = new ScriptedSql().answer('read-publication-facts', [readyGarageRoyNordRow({ wifi_note: null })]);

    expect((await repositoryOn(scripted).readPublicationFacts(ROY_OPERATOR, GARAGE_ROY_NORD_ID))?.wifi).toBeNull();
  });

  it('puts the lot online after judging the checklist under the owned lot’s lock, all on one transaction', async () => {
    const scripted = lockedLot().answer('read-publication-facts', [readyGarageRoyNordRow()]);

    expect(await repositoryOn(scripted).changeOnline(ROY_OPERATOR, GARAGE_ROY_NORD_ID, { online: true, now: NOW })).toBe('written');

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'read-publication-facts', 'set-lot-online']);
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber)).size).toBe(1);
    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
    expect(scripted.statement('set-lot-online')?.params).toEqual([true, GARAGE_ROY_NORD_ID]);
  });

  const [entryCell, exitCell] = readyGarageRoyNordRow().gates;

  it.each([
    ['Stripe is not verified', { kyc_status: 'PENDING' as const }],
    ['a gate is not verified', { gates: [{ id: 'gate-entree', name: 'Entrée Nord', kind: 'ENTRY' as const, verified_at: null }, ...(exitCell === undefined ? [] : [exitCell])] }],
    ['the exit gate is gone', { gates: entryCell === undefined ? [] : [entryCell] }],
  ])('refuses LOT_NOT_READY without writing when %s', async (_case, change) => {
    const scripted = lockedLot().answer('read-publication-facts', [readyGarageRoyNordRow(change)]);

    expect(await repositoryOn(scripted).changeOnline(ROY_OPERATOR, GARAGE_ROY_NORD_ID, { online: true, now: NOW })).toBe('LOT_NOT_READY');
    expect(scripted.count('set-lot-online')).toBe(0);
  });

  it('writes nothing when the lot is already online', async () => {
    const scripted = lockedLot().answer('read-publication-facts', [readyGarageRoyNordRow({ is_online: true, wifi_note: null })]);

    expect(await repositoryOn(scripted).changeOnline(ROY_OPERATOR, GARAGE_ROY_NORD_ID, { online: true, now: NOW })).toBe('written');
    expect(scripted.count('set-lot-online')).toBe(0);
  });

  it('takes the lot offline without reading the checklist', async () => {
    const scripted = lockedLot();

    expect(await repositoryOn(scripted).changeOnline(ROY_OPERATOR, GARAGE_ROY_NORD_ID, { online: false, now: NOW })).toBe('written');
    expect(scripted.count('read-publication-facts')).toBe(0);
    expect(scripted.statement('set-lot-online')?.params).toEqual([false, GARAGE_ROY_NORD_ID]);
  });

  it.each([true, false])('never locks or writes another operator’s lot (online %s)', async (online) => {
    const scripted = new ScriptedSql();

    expect(await repositoryOn(scripted).changeOnline(ROY_OPERATOR, GARAGE_ROY_NORD_ID, { online, now: NOW })).toBe('LOT_NOT_FOUND');
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot']);
  });

  it('answers LOT_BUSY when the lock wait runs out', async () => {
    const scripted = new ScriptedSql().fail('lock-owned-lot', LOCK_NOT_AVAILABLE);

    expect(await repositoryOn(scripted).changeOnline(ROY_OPERATOR, GARAGE_ROY_NORD_ID, { online: true, now: NOW })).toBe('LOT_BUSY');
  });
});
