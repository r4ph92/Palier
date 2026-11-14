import type { DashboardMapAisle } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import { enMap } from '../src/i18n/enMap.ts';
import { frMap } from '../src/i18n/frMap.ts';
import { batteryMarkOf } from '../src/lotMap/batteryMark.ts';
import { parkingDemoMap } from './fakeMapData.ts';

const AISLE_A = parkingDemoMap.levels[0]?.aisles[0] as DashboardMapAisle;

describe('QA #76: the battery mark of a reading older than 90 days', () => {
  const staleReading: DashboardMapAisle = { ...AISLE_A, batteryPercent: 90, batteryReportedAt: '2026-08-15T04:00:00.000Z', batteryStatus: 'UNKNOWN' };

  it('reads Pile inconnue without the old percent, in the warning tone', () => {
    expect(batteryMarkOf(staleReading, frMap, 'fr')).toEqual({ tone: 'warning', label: 'Pile inconnue' });
  });

  it('reads Unknown battery in English, without the old percent', () => {
    expect(batteryMarkOf(staleReading, enMap, 'en')).toEqual({ tone: 'warning', label: 'Unknown battery' });
  });

  it('reads a fresh 0 % as Pile faible · 0 %, not as unknown', () => {
    const empty: DashboardMapAisle = { ...AISLE_A, batteryPercent: 0, batteryReportedAt: '2026-11-13T19:05:00.000Z', batteryStatus: 'LOW' };

    expect(batteryMarkOf(empty, frMap, 'fr')).toEqual({ tone: 'danger', label: 'Pile faible · 0 %' });
  });
});
