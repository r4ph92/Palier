import type { RefObject } from 'react';
import { PalierUnreachableError, type LotsClient } from '../api/LotsClient';
import type { DeviceLocationClient } from '../deviceLocation/DeviceLocationClient';
import { locateDriver, positionOf, type DriverLocation } from '../deviceLocation/locateDriver';
import type { LotsAction, ReadKind } from './lotsReducer';
import { nearbyLots } from './nearbyLots';

export interface LotSources {
  readonly client: LotsClient;
  readonly locationClient: DeviceLocationClient;
  readonly lastLocation: RefObject<DriverLocation | null>;
}

// The position comes first, so the list shows once, already sorted. A missed poll keeps the list on screen
// with the time of its last read; a missed full read shows the error.
export async function readLots(sources: LotSources, readKind: ReadKind): Promise<LotsAction> {
  const location = await locationFor(sources, readKind);
  try {
    const lots = await sources.client.listLots();
    return { type: 'settled', state: { status: 'loaded', lots: nearbyLots(lots, positionOf(location)), location, updatedAt: new Date() } };
  } catch (error) {
    if (!(error instanceof PalierUnreachableError)) {
      throw error;
    }
    return readKind === 'poll' ? { type: 'pollMissed' } : { type: 'settled', state: { status: 'error' } };
  }
}

async function locationFor({ locationClient, lastLocation }: LotSources, readKind: ReadKind): Promise<DriverLocation> {
  if (readKind === 'poll' && lastLocation.current !== null) {
    return lastLocation.current;
  }
  const location = await locateDriver(locationClient);
  lastLocation.current = location;
  return location;
}
