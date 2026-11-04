import type { ParkedConfidence } from '../positioning/PositioningModule';
import type { Connectivity } from './SimulatedPositioningModule';
import { formatLogTime } from './formatLogTime';

const UUID_PREFIX_LENGTH = 8;
const CONFIDENCE_LABELS: Record<ParkedConfidence, string> = { low: 'faible', medium: 'moyenne', high: 'élevée' };

export const describeCommand = {
  startMonitoring: (uuid: string, major: number): string => `startMonitoring uuid=${uuid.slice(0, UUID_PREFIX_LENGTH)} major=${major}`,
  stopMonitoring: (): string => 'stopMonitoring',
  keepAlive: (until: number): string => `keepAlive until=${formatLogTime(new Date(until))}`,
  flushOfflineQueue: (): string => 'flushOfflineQueue',
};

export const describeEvent = {
  aisleChanged: (minor: number): string => `Allée détectée : minor ${minor}`,
  lotExit: (): string => 'Sortie de la région du parking',
  parkedDetected: (confidence: ParkedConfidence): string => `Stationné détecté : confiance ${CONFIDENCE_LABELS[confidence]}`,
  queueFlushed: (count: number): string => `File vidée : ${count} élément(s)`,
};

export function describeConnectivity(connectivity: Connectivity): string {
  return connectivity === 'offline' ? 'Réseau coupé' : 'Réseau rétabli';
}
