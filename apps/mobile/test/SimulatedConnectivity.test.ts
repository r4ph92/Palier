import type { Connectivity } from '../src/api/ConnectivitySource';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';

function toolkitAt1802() {
  const toolkit = createSimulatedToolkit(() => new Date(2026, 10, 4, 18, 2).getTime());
  return { simulator: toolkit.module as SimulatedPositioningModule, connectivity: toolkit.connectivity };
}

describe('the network of the developer panel', () => {
  it('starts online', () => {
    expect(toolkitAt1802().connectivity.current()).toBe('online');
  });

  it('tells the app when « Réseau coupé » then « Réseau rétabli » are tapped', () => {
    const { simulator, connectivity } = toolkitAt1802();
    const heard: Connectivity[] = [];
    connectivity.subscribe((next) => heard.push(next));

    simulator.setConnectivity('offline');
    simulator.setConnectivity('online');

    expect(heard).toEqual(['offline', 'online']);
    expect(connectivity.current()).toBe('online');
  });

  it('stops telling a listener that unsubscribed', () => {
    const { simulator, connectivity } = toolkitAt1802();
    const listener = jest.fn();
    const unsubscribe = connectivity.subscribe(listener);
    unsubscribe();

    simulator.setConnectivity('offline');

    expect(listener).not.toHaveBeenCalled();
    expect(connectivity.current()).toBe('offline');
  });
});
