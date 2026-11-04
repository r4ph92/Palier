import type { PositioningCore } from '../positioning/PositioningCore';
import type { DeveloperEntry } from '../screens/DeveloperEntry';
import type { DeveloperTools } from './DeveloperToolkit';
import { commandActions, signalActions } from './panelActions';
import { recordEvents } from './recordEvents';
import { SignalJournal } from './SignalJournal';
import { SimulatedPositioningModule } from './SimulatedPositioningModule';
import { SimulatedSignalsPanel } from './SimulatedSignalsPanel';

const journal = new SignalJournal(() => new Date());
const simulator = new SimulatedPositioningModule(journal, () => Date.now());

function bind(core: PositioningCore): DeveloperEntry {
  core.subscribe(recordEvents(journal));
  const actions = [...signalActions(simulator), ...commandActions(core, () => Date.now())];
  return {
    label: 'Développeur',
    Panel: ({ onBack }) => <SimulatedSignalsPanel journal={journal} actions={actions} onBack={onBack} />,
  };
}

export const developerTools: DeveloperTools = { module: simulator, bind };
