import type { PositioningListener } from '../positioning/PositioningModule';
import { describeEvent } from './describeSignal';
import type { SignalJournal } from './SignalJournal';

export function recordEvents(journal: SignalJournal): PositioningListener {
  return {
    onAisleChanged: (minor) => journal.append(describeEvent.aisleChanged(minor)),
    onLotExit: () => journal.append(describeEvent.lotExit()),
    onParkedDetected: (confidence) => journal.append(describeEvent.parkedDetected(confidence)),
    onQueueFlushed: (count) => journal.append(describeEvent.queueFlushed(count)),
  };
}
