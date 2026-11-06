import type { PositioningCore } from '../positioning/PositioningCore';
import type { DeveloperEntry } from './DeveloperEntry';

export interface DeviceTools {
  readonly developerEntry: DeveloperEntry | undefined;
  readonly positioning: PositioningCore;
}
