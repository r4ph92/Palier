import { useEffect, useMemo } from 'react';
import type { ConnectivitySource } from '../api/ConnectivitySource';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { PositioningCore } from '../positioning/PositioningCore';
import { OfflineWalkQueue } from './OfflineWalkQueue';
import { OfflineWalkSender } from './OfflineWalkSender';
import type { OfflineWalkStore } from './OfflineWalkStore';

export interface OfflineWalkSenderSources {
  readonly client: ParkingSessionClient;
  readonly store: OfflineWalkStore;
  readonly connectivity: ConnectivitySource;
  readonly positioning: PositioningCore;
}

// A new token gives new clients, so a new sender; the old one stops retrying.
export function useOfflineWalkSender({ client, store, connectivity, positioning }: OfflineWalkSenderSources): OfflineWalkSender {
  const sender = useMemo(
    () => new OfflineWalkSender({ client, queue: new OfflineWalkQueue(store), connectivity, positioning }),
    [client, store, connectivity, positioning],
  );
  useEffect(() => sender.start(), [sender]);
  return sender;
}
