import type { PositioningCore } from '../positioning/PositioningCore';
import type { DeveloperEntry } from '../screens/DeveloperEntry';
import type { DeveloperToolkit } from './DeveloperToolkit';
import { commandActions, signalActions } from './panelActions';
import { recordEvents } from './recordEvents';
import { SignalJournal } from './SignalJournal';
import { SimulatedConnectivity } from './SimulatedConnectivity';
import { SimulatedPositioningModule } from './SimulatedPositioningModule';
import { SimulatedSignalsPanel } from './SimulatedSignalsPanel';

export function createSimulatedToolkit(now: () => number): DeveloperToolkit {
  const journal = new SignalJournal(() => new Date(now()));
  const connectivity = new SimulatedConnectivity();
  const simulator = new SimulatedPositioningModule(journal, now, connectivity);

  function bind(core: PositioningCore): DeveloperEntry {
    core.subscribe(recordEvents(journal));
    const signals = signalActions(simulator);
    const commands = commandActions(core, now);
    return {
      label: 'Développeur',
      Panel: ({ onBack }) => <SimulatedSignalsPanel journal={journal} signals={signals} commands={commands} onBack={onBack} />,
    };
  }

  return { module: simulator, connectivity, bind };
}

export const simulatedToolkit: DeveloperToolkit = createSimulatedToolkit(() => Date.now());
