import type { PositioningCore } from '../positioning/PositioningCore';
import type { DeveloperEntry } from '../screens/DeveloperEntry';
import type { DeveloperToolkit } from './DeveloperToolkit';
import { commandActions, signalActions } from './panelActions';
import { recordEvents } from './recordEvents';
import { SignalJournal } from './SignalJournal';
import { SimulatedPositioningModule } from './SimulatedPositioningModule';
import { SimulatedSignalsPanel } from './SimulatedSignalsPanel';

export function createSimulatedToolkit(now: () => number): DeveloperToolkit {
  const journal = new SignalJournal(() => new Date(now()));
  const simulator = new SimulatedPositioningModule(journal, now);

  function bind(core: PositioningCore): DeveloperEntry {
    core.subscribe(recordEvents(journal));
    const signals = signalActions(simulator, core);
    const commands = commandActions(core, now);
    return {
      label: 'Développeur',
      Panel: ({ onBack }) => <SimulatedSignalsPanel journal={journal} signals={signals} commands={commands} onBack={onBack} />,
    };
  }

  return { module: simulator, bind };
}

export const simulatedToolkit: DeveloperToolkit = createSimulatedToolkit(() => Date.now());
