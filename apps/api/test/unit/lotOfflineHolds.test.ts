import { describe, expect, it } from 'vitest';
import { PostgresLotPublicationRepository } from '../../src/infrastructure/postgres/PostgresLotPublicationRepository.ts';
import { GARAGE_ROY_NORD_ID } from './fakes/publicationFixtures.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const ROY_OPERATOR = 'operator-roy';
const NOW = new Date('2026-11-15T14:00:00Z');

function offlineWithHolds(spotIds: readonly string[]): ScriptedSql {
  return new ScriptedSql()
    .answer('lock-owned-lot', [{ id: GARAGE_ROY_NORD_ID }])
    .answer('release-lot-spot-holds', spotIds.map((spot_id) => ({ spot_id })))
    .answer('free-held-spot', spotIds.map((id) => ({ id })));
}

function takeOffline(scripted: ScriptedSql) {
  return new PostgresLotPublicationRepository(scripted.database()).changeOnline(ROY_OPERATOR, GARAGE_ROY_NORD_ID, { online: false, now: NOW });
}

describe('putting a lot offline while drivers hold spots in it', () => {
  it('ends every active hold of the lot and frees their spots, in the same locked transaction', async () => {
    const scripted = offlineWithHolds(['spot-A-1', 'spot-B-4']);

    expect(await takeOffline(scripted)).toBe('written');

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-owned-lot', 'set-lot-online', 'release-lot-spot-holds', 'free-held-spot']);
    expect(new Set(scripted.statements.map(({ transactionNumber }) => transactionNumber))).toEqual(new Set([expect.any(Number)]));
  });

  it('releases only the active holds of this lot', async () => {
    const scripted = offlineWithHolds(['spot-A-1']);

    await takeOffline(scripted);

    const { text, params } = scripted.statement('release-lot-spot-holds') ?? { text: '', params: [] };
    expect(text).toMatch(/where lot_id = \$1 and status = 'ACTIVE'\s+returning spot_id$/);
    expect(params).toEqual([GARAGE_ROY_NORD_ID]);
  });

  it('frees only spots still held, stamped with the change instant', async () => {
    const scripted = offlineWithHolds(['spot-A-1', 'spot-B-4']);

    await takeOffline(scripted);

    const { text, params } = scripted.statement('free-held-spot') ?? { text: '', params: [] };
    expect(text).toMatch(/and state = 'HELD'\s+returning id$/);
    expect(params).toEqual([NOW.toISOString(), 'spot-A-1', 'spot-B-4']);
  });

  it('frees no spot when nobody holds one', async () => {
    const scripted = offlineWithHolds([]);

    await takeOffline(scripted);

    expect(scripted.count('free-held-spot')).toBe(0);
  });
});
