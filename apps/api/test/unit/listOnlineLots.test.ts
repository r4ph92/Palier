import { describe, expect, it } from 'vitest';
import { listOnlineLots } from '../../src/domain/lots/listOnlineLots.ts';
import { PostgresLotAvailabilityRepository } from '../../src/infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { capturedSqlDatabase } from './fakes/capturedSql.ts';
import { parkingDemoOnline, repositoryReturning } from './fakes/lotFixtures.ts';

function onlineLots(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({ ...parkingDemoOnline(), id: `lot-${index}`, name: `Lot ${String(index).padStart(2, '0')}` }));
}

describe('listOnlineLots', () => {
  it('lists every online lot, even past 50, in the order read', async () => {
    const lots = await listOnlineLots(repositoryReturning([...onlineLots(59), { ...parkingDemoOnline(), id: 'lot-zenith', name: 'Zénith' }]));

    expect(lots).toHaveLength(60);
    expect(lots.at(-1)?.name).toBe('Zénith');
  });

  it('lists nothing when no lot is online', async () => {
    expect(await listOnlineLots(repositoryReturning([]))).toEqual([]);
  });
});

describe('PostgresLotAvailabilityRepository.findOnlineLots', () => {
  it('reads every online lot by name, with no limit', async () => {
    const { database, statements } = capturedSqlDatabase();

    await new PostgresLotAvailabilityRepository(database).findOnlineLots();

    const lotStatement = statements.find((statementText) => statementText.includes('"parking_lot"."is_online"'));
    expect(lotStatement).toMatch(/order by "parking_lot"\."name" asc$/);
    expect(lotStatement).not.toMatch(/\blimit\b/i);
  });
});
