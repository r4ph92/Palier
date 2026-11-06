import { NullPositioningModule } from './NullPositioningModule';
import { PositioningCore } from './PositioningCore';

// For an app built without positioning: commands go nowhere and no aisle is ever reported.
export const nullPositioningCore = new PositioningCore(new NullPositioningModule());
