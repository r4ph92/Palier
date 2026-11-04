import type { PositioningCore } from '../positioning/PositioningCore';
import type { PositioningModule } from '../positioning/PositioningModule';
import type { DeveloperEntry } from '../screens/DeveloperEntry';

export interface DeveloperTools {
  readonly module: PositioningModule;
  bind(core: PositioningCore): DeveloperEntry;
}
