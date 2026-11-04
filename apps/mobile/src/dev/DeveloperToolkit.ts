import type { PositioningCore } from '../positioning/PositioningCore';
import type { PositioningModule } from '../positioning/PositioningModule';
import type { DeveloperEntry } from '../screens/DeveloperEntry';

export interface DeveloperToolkit {
  readonly module: PositioningModule;
  bind(core: PositioningCore): DeveloperEntry;
}
