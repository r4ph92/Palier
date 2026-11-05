import { PalierUnreachableError, type LotsClient } from '../api/LotsClient';
import type { DeviceLocationClient } from '../deviceLocation/DeviceLocationClient';
import { locateDriver, positionOf, type DriverLocation } from '../deviceLocation/locateDriver';
import type { LotsAction } from './lotsReducer';
import { nearbyLots } from './nearbyLots';

export interface LotSources {
  readonly client: LotsClient;
  readonly locationClient: DeviceLocationClient;
}

export async function readLots(sources: LotSources, knownLocation: DriverLocation | null): Promise<LotsAction> {
  const location = knownLocation ?? (await locateDriver(sources.locationClient));
  try {
    const lots = await sources.client.listLots();
    return { type: 'loaded', state: { status: 'loaded', lots: nearbyLots(lots, positionOf(location)), location, updatedAt: new Date() } };
  } catch (error) {
    if (!(error instanceof PalierUnreachableError)) {
      throw error;
    }
    return { type: 'unreachable' };
  }
}
