import { SignalJournal } from '../src/dev/SignalJournal';
import { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import { recordEvents } from '../src/dev/recordEvents';
import { PositioningCore } from '../src/positioning/PositioningCore';
import type { PositioningListener } from '../src/positioning/PositioningModule';

const UUID = 'B9407F30-F5F8-466E-AFF9-25556B57FE6D';
const CLOCK = new Date(2026, 10, 4, 18, 2, 5);

function createRig() {
  const journal = new SignalJournal(() => CLOCK);
  const simulator = new SimulatedPositioningModule(journal, () => CLOCK.getTime());
  const core = new PositioningCore(simulator);
  return { journal, simulator, core };
}

function texts(journal: SignalJournal): string[] {
  return journal.snapshot().map((entry) => entry.text);
}

function spyListener(): jest.Mocked<PositioningListener> {
  return { onAisleChanged: jest.fn(), onLotExit: jest.fn(), onParkedDetected: jest.fn(), onQueueFlushed: jest.fn() };
}

describe('PositioningCore commands', () => {
  it('forwards each command to the module, which records its arguments', () => {
    const { journal, core } = createRig();

    core.startMonitoring(UUID, 1);
    core.keepAlive(new Date(2026, 10, 4, 18, 12, 0).getTime());
    core.flushOfflineQueue();
    core.stopMonitoring();

    expect(texts(journal)).toEqual([
      'stopMonitoring',
      'flushOfflineQueue',
      'keepAlive until=18 h 12 min 00 s',
      'startMonitoring uuid=B9407F30 major=1',
    ]);
  });
});

describe('PositioningCore events', () => {
  it('fans each module event out to every subscriber with its arguments', () => {
    const { simulator, core } = createRig();
    const first = spyListener();
    const second = spyListener();
    core.subscribe(first);
    core.subscribe(second);

    simulator.enterAisle(2);
    simulator.exitLot();
    simulator.detectParked('high');

    for (const listener of [first, second]) {
      expect(listener.onAisleChanged).toHaveBeenCalledWith(2, CLOCK.getTime());
      expect(listener.onLotExit).toHaveBeenCalledWith(CLOCK.getTime());
      expect(listener.onParkedDetected).toHaveBeenCalledWith('high', CLOCK.getTime());
    }
  });

  it('stops notifying a subscriber that unsubscribed', () => {
    const { simulator, core } = createRig();
    const listener = spyListener();
    const unsubscribe = core.subscribe(listener);

    unsubscribe();
    simulator.enterAisle(1);

    expect(listener.onAisleChanged).not.toHaveBeenCalled();
  });

  it('journals the events received through the core in French', () => {
    const { journal, simulator, core } = createRig();
    core.subscribe(recordEvents(journal));

    simulator.enterAisle(2);
    simulator.detectParked('high');

    expect(texts(journal)).toEqual(['Stationné détecté : confiance élevée', 'Allée détectée : minor 2']);
  });
});

describe('SignalJournal', () => {
  it('keeps the newest 100 entries and the same snapshot until something changes', () => {
    const journal = new SignalJournal(() => CLOCK);
    for (let index = 0; index < 105; index += 1) {
      journal.append(`entry ${index}`);
    }
    const snapshot = journal.snapshot();

    expect(snapshot).toHaveLength(100);
    expect(snapshot[0]?.text).toBe('entry 104');
    expect(journal.snapshot()).toBe(snapshot);
  });
});
