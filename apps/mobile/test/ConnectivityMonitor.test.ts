import { ConnectivityMonitor } from '../src/positioning/ConnectivityMonitor';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { positioningRig } from './positioningRig';

describe('the connectivity state (story #26)', () => {
  it('starts online and tells its listeners only when the state changes', () => {
    const monitor = new ConnectivityMonitor();
    const listener = jest.fn();
    monitor.subscribe(listener);

    monitor.set('online');
    monitor.set('offline');
    monitor.set('offline');

    expect(monitor.current).toBe('offline');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('offline');
  });

  it('stops telling a listener that unsubscribed', () => {
    const monitor = new ConnectivityMonitor();
    const listener = jest.fn();
    monitor.subscribe(listener)();

    monitor.set('offline');

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('asking the core to flush the offline queue (story #26)', () => {
  it('runs every flush request after sending the flushOfflineQueue command', () => {
    const { core, commands }: { core: PositioningCore; commands: () => string[] } = positioningRig();
    const request = jest.fn(() => expect(commands()).toContain('flushOfflineQueue'));
    core.onFlushRequested(request);

    core.flushOfflineQueue();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops running a flush request that unsubscribed', () => {
    const { core } = positioningRig();
    const request = jest.fn();
    core.onFlushRequested(request)();

    core.flushOfflineQueue();

    expect(request).not.toHaveBeenCalled();
  });
});
