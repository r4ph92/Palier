import type { ConnectivitySource } from '../api/ConnectivitySource';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { PositioningModule } from '../positioning/PositioningModule';
import type { DeveloperEntry } from '../screens/DeveloperEntry';

export interface DeveloperToolkit {
  readonly module: PositioningModule;
  readonly connectivity: ConnectivitySource;
  bind(core: PositioningCore): DeveloperEntry;
}
