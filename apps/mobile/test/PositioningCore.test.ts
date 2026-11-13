import { SignalJournal } from '../src/dev/SignalJournal';
import { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import { recordEvents } from '../src/dev/recordEvents';
import { PositioningCore } from '../src/positioning/PositioningCore';
import type { PositioningListener } from '../src/positioning/PositioningModule';
import { PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';

const UUID = PLATFORM_BEACON_UUID;
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
      `startMonitoring uuid=${UUID.slice(0, 8)} major=1`,
    ]);
  });
});

describe('PositioningCore stopping the keep-alive (story #18)', () => {
  it.each([
    ['now', CLOCK.getTime()],
    ['an instant already past', CLOCK.getTime() - 60_000],
  ])('marks a keep-alive until %s as stopping it', (_case, until) => {
    const { journal, core } = createRig();

    core.keepAlive(until);

    expect(texts(journal)[0]).toMatch(/^keepAlive until=\d{1,2} h \d{2} min \d{2} s \(arrêt\)$/);
  });

  it('stops the keep-alive at the instant given, through the keepAlive command', () => {
    const { journal, core } = createRig();

    core.stopKeepAliveAt(CLOCK.getTime());

    expect(texts(journal)).toEqual(['keepAlive until=18 h 02 min 05 s (arrêt)']);
  });

  it('keeps a keep-alive one second ahead a plain extension', () => {
    const { journal, core } = createRig();

    core.keepAlive(CLOCK.getTime() + 1000);

    expect(texts(journal)).toEqual(['keepAlive until=18 h 02 min 06 s']);
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

  it('forwards the queue flush a flushOfflineQueue command ends with to every subscriber', () => {
    const { core } = createRig();
    const first = spyListener();
    const second = spyListener();
    core.subscribe(first);
    core.subscribe(second);

    core.flushOfflineQueue();

    expect(first.onQueueFlushed).toHaveBeenCalledWith(0);
    expect(second.onQueueFlushed).toHaveBeenCalledWith(0);
  });

  describe('when the first subscriber throws', () => {
    const emitters: [string, (simulator: SimulatedPositioningModule) => void, keyof PositioningListener][] = [
      ['onAisleChanged', (simulator) => simulator.enterAisle(2), 'onAisleChanged'],
      ['onLotExit', (simulator) => simulator.exitLot(), 'onLotExit'],
      ['onParkedDetected', (simulator) => simulator.detectParked('high'), 'onParkedDetected'],
      ['onQueueFlushed', (simulator) => simulator.flushOfflineQueue(), 'onQueueFlushed'],
    ];

    it.each(emitters)('still delivers %s to the second subscriber, without throwing', (_name, emit, event) => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { simulator, core } = createRig();
      const failing = spyListener();
      const healthy = spyListener();
      failing[event].mockImplementation(() => {
        throw new Error('subscriber failed');
      });
      core.subscribe(failing);
      core.subscribe(healthy);

      expect(() => emit(simulator)).not.toThrow();

      expect(healthy[event]).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });
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
