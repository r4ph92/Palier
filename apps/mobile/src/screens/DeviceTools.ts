import type { PositioningCore } from '../positioning/PositioningCore';
import type { DeveloperEntry } from './DeveloperEntry';

// What the device brings besides the API: the developer panel in development builds, and beacon positioning.
export interface DeviceTools {
  readonly developerEntry: DeveloperEntry | undefined;
  readonly positioning: PositioningCore;
}
