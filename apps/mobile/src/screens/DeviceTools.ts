import type { PositioningCore } from '../positioning/PositioningCore';
import type { ParkedSignalQueue } from '../parkingSessions/ParkedSignalQueue';
import type { DeveloperEntry } from './DeveloperEntry';

export interface DeviceTools {
  readonly developerEntry: DeveloperEntry | undefined;
  readonly positioning: PositioningCore;
  // The walks the network could not carry yet.
  readonly parkedSignals: ParkedSignalQueue;
}
