import { describe, expect, it, vi } from 'vitest';
import type { DashboardLotMap } from '@palier/shared-types';
import { addLevelOfMember, type LotMapSources } from '../../src/domain/dashboard/lotMap.ts';
import { LOT_MAP_WRITTEN, type LotMapWrite } from '../../src/domain/dashboard/LotMapRepository.ts';

const savedMap: DashboardLotMap = { lotId: 'lot-roy', lotName: 'Garage Roy', platformUuid: 'uuid', beaconMajor: 4, levels: [] };

function sourcesOf(operatorId: string | null): LotMapSources {
  return {
    operators: { findOperatorOfMember: vi.fn(() => Promise.resolve(operatorId === null ? null : { id: operatorId, legalName: 'Roy', kycStatus: 'VERIFIED' as const })) },
    maps: {
      readLotMap: vi.fn(() => Promise.resolve(savedMap)),
      addLevel: vi.fn(() => Promise.resolve<LotMapWrite>(LOT_MAP_WRITTEN)),
      reorderLevels: vi.fn(() => Promise.resolve<LotMapWrite>(LOT_MAP_WRITTEN)),
      addAisle: vi.fn(() => Promise.resolve<LotMapWrite>(LOT_MAP_WRITTEN)),
    },
  };
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
