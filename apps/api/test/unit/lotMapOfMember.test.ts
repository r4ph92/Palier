import { describe, expect, it, vi } from 'vitest';
import { addLevelOfMember, readLotMapOfMember, recordBeaconBatteryOfMember, type LotMapSources } from '../../src/domain/dashboard/lotMap.ts';
import { LOT_MAP_WRITTEN, type LotMapWrite, type StoredLotMap, type StoredMapAisle } from '../../src/domain/dashboard/LotMapRepository.ts';

const NOW = new Date('2026-11-13T19:05:00Z');
const DAY = 24 * 60 * 60 * 1000;
const member = { userId: 'sophie', lotId: 'lot-demo' };
const aisleA = { id: 'aisle-a', code: 'A', beaconMinor: 1, isExitLane: false, rectangle: null };
const savedMap: StoredLotMap = { lotId: 'lot-roy', lotName: 'Garage Roy', platformUuid: 'uuid', beaconMajor: 4, levels: [] };

function mapWith(aisles: readonly StoredMapAisle[]): StoredLotMap {
  return { ...savedMap, levels: [{ id: 'p1', code: 'P1', displayOrder: 1, aisles }] };
}

function sourcesOf(operatorId: string | null, stored: StoredLotMap = savedMap) {
  return {
    operators: { findOperatorOfMember: vi.fn(() => Promise.resolve(operatorId === null ? null : { id: operatorId, legalName: 'Roy', kycStatus: 'VERIFIED' as const })) },
    maps: {
      readLotMap: vi.fn(() => Promise.resolve(stored)),
      addLevel: vi.fn(() => Promise.resolve<LotMapWrite>(LOT_MAP_WRITTEN)),
      reorderLevels: vi.fn(() => Promise.resolve<LotMapWrite>(LOT_MAP_WRITTEN)),
      addAisle: vi.fn(() => Promise.resolve<LotMapWrite>(LOT_MAP_WRITTEN)),
      recordBeaconBattery: vi.fn(() => Promise.resolve<LotMapWrite>(LOT_MAP_WRITTEN)),
    },
    clock: () => NOW,
  } satisfies LotMapSources;
}

describe('changing the map of a member’s lot', () => {
  it('looks the operator up once, writes, then reads the saved map of that operator', async () => {
    const sources = sourcesOf('operator-roy');

    expect(await addLevelOfMember(sources, { userId: 'pierre', lotId: 'lot-roy' }, { code: 'P1' })).toEqual(savedMap);
    expect(sources.operators.findOperatorOfMember).toHaveBeenCalledTimes(1);
    expect(sources.maps.readLotMap).toHaveBeenCalledWith('operator-roy', 'lot-roy');
  });

  it('answers a member without an operator not found, before any write', async () => {
    const sources = sourcesOf(null);

    await expect(addLevelOfMember(sources, { userId: 'nouvel', lotId: 'lot-roy' }, { code: 'P1' })).rejects.toMatchObject({ reason: 'LOT_NOT_FOUND' });
    expect(sources.maps.addLevel).not.toHaveBeenCalled();
  });
});

describe('the battery of each beacon on the map', () => {
  it.each([
    ['15 % recorded a minute ago', { batteryPercent: 15, batteryReportedAt: new Date(NOW.getTime() - 60_000) }, 'LOW'],
    ['80 % recorded 90 days ago', { batteryPercent: 80, batteryReportedAt: new Date(NOW.getTime() - 90 * DAY) }, 'OK'],
    ['80 % recorded 91 days ago', { batteryPercent: 80, batteryReportedAt: new Date(NOW.getTime() - 91 * DAY) }, 'UNKNOWN'],
    ['no reading', { batteryPercent: null, batteryReportedAt: null }, 'UNKNOWN'],
  ] as const)('reads %s as %s at the moment of the read', async (_case, reading, batteryStatus) => {
    const map = await readLotMapOfMember(sourcesOf('operator-lavoie', mapWith([{ ...aisleA, ...reading }])), member);

    expect(map.levels[0]?.aisles[0]).toEqual({ ...aisleA, ...reading, batteryReportedAt: reading.batteryReportedAt?.toISOString() ?? null, batteryStatus });
  });

  it('records a reading stamped by the server clock, for the aisle of the member’s lot', async () => {
    const sources = sourcesOf('operator-lavoie');

    await recordBeaconBatteryOfMember(sources, { ...member, aisleId: 'aisle-a' }, { percent: 15 });

    expect(sources.maps.recordBeaconBattery).toHaveBeenCalledWith('operator-lavoie', { lotId: 'lot-demo', aisleId: 'aisle-a' }, { percent: 15, reportedAt: NOW });
  });

  it.each([-1, 101, 1.5])('refuses %p percent before looking the operator up', (percent) => {
    const sources = sourcesOf('operator-lavoie');

    expect(() => recordBeaconBatteryOfMember(sources, { ...member, aisleId: 'aisle-a' }, { percent })).toThrow(expect.objectContaining({ reason: 'BATTERY_PERCENT_INVALID' }));
    expect(sources.operators.findOperatorOfMember).not.toHaveBeenCalled();
  });
});
