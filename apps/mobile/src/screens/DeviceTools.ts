import type { ConnectivitySource } from '../api/ConnectivitySource';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { DeveloperEntry } from './DeveloperEntry';

export interface DeviceTools {
  readonly developerEntry: DeveloperEntry | undefined;
  readonly positioning: PositioningCore;
  readonly connectivity: ConnectivitySource;
}
