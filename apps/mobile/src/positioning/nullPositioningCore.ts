import { NullPositioningModule } from './NullPositioningModule';
import { PositioningCore } from './PositioningCore';

export const nullPositioningCore = new PositioningCore(new NullPositioningModule());
