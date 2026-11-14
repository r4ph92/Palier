import { PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';
import type { Connectivity } from '../positioning/Connectivity';
import type { PositioningCore } from '../positioning/PositioningCore';
import { describeConnectivity } from './describeSignal';
import type { SimulatedPositioningModule } from './SimulatedPositioningModule';

export interface PanelAction {
  readonly label: string;
  readonly run: () => void;
}

const DEVELOPMENT_MAJOR = 1;
const KEEP_ALIVE_MILLISECONDS = 10 * 60 * 1000;

export function signalActions(simulator: SimulatedPositioningModule, core: PositioningCore): readonly PanelAction[] {
  return [
    { label: 'Allée 1', run: () => simulator.enterAisle(1) },
    { label: 'Allée 2', run: () => simulator.enterAisle(2) },
    { label: 'Voie de sortie (minor 0)', run: () => simulator.enterAisle(0) },
    { label: 'Sortie de la région du parking', run: () => simulator.exitLot() },
    { label: 'Stationné (à pied, confiance élevée)', run: () => simulator.detectParked('high') },
    { label: describeConnectivity('offline'), run: () => setConnectivity(simulator, core, 'offline') },
    { label: describeConnectivity('online'), run: () => setConnectivity(simulator, core, 'online') },
  ];
}

function setConnectivity(simulator: SimulatedPositioningModule, core: PositioningCore, connectivity: Connectivity): void {
  simulator.setConnectivity(connectivity);
  core.connectivity.set(connectivity);
}

export function commandActions(core: PositioningCore, now: () => number): readonly PanelAction[] {
  return [
    { label: `startMonitoring major=${DEVELOPMENT_MAJOR}`, run: () => core.startMonitoring(PLATFORM_BEACON_UUID, DEVELOPMENT_MAJOR) },
    { label: 'stopMonitoring', run: () => core.stopMonitoring() },
    { label: 'keepAlive (+10 min)', run: () => core.keepAlive(now() + KEEP_ALIVE_MILLISECONDS) },
    { label: 'flushOfflineQueue', run: () => core.flushOfflineQueue() },
  ];
}
