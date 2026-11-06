import { SignalJournal } from '../src/dev/SignalJournal';
import { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import { PositioningCore } from '../src/positioning/PositioningCore';

// A core over the simulated module, with the commands it received readable oldest first.
export function positioningRig() {
  const journal = new SignalJournal(() => new Date(2026, 10, 4, 18, 2));
  const simulator = new SimulatedPositioningModule(journal, () => 0);
  const core = new PositioningCore(simulator);
  const commands = () => journal.snapshot().map((entry) => entry.text).reverse();
  return { core, simulator, commands };
}
