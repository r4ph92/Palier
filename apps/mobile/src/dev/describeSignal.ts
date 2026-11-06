import type { ParkedConfidence } from '../positioning/PositioningModule';
import type { Connectivity } from './Connectivity';
import { formatLogTime } from './formatLogTime';

const UUID_PREFIX_LENGTH = 8;
const CONFIDENCE_LABELS: Record<ParkedConfidence, string> = { low: 'faible', medium: 'moyenne', high: 'élevée' };

function describeConfidence(confidence: ParkedConfidence): string {
  return Object.hasOwn(CONFIDENCE_LABELS, confidence) ? `confiance ${CONFIDENCE_LABELS[confidence]}` : `confiance inconnue (${confidence})`;
}

export const describeCommand = {
  startMonitoring: (uuid: string, major: number): string => `startMonitoring uuid=${String(uuid).slice(0, UUID_PREFIX_LENGTH)} major=${major}`,
  stopMonitoring: (): string => 'stopMonitoring',
  keepAlive: (until: number): string => `keepAlive until=${formatLogTime(new Date(until))}`,
  keepAliveStop: (until: number): string => `keepAlive until=${formatLogTime(new Date(until))} (arrêt)`,
  flushOfflineQueue: (): string => 'flushOfflineQueue',
};

export const describeEvent = {
  aisleChanged: (minor: number): string => `Allée détectée : minor ${minor}`,
  lotExit: (): string => 'Sortie de la région du parking',
  parkedDetected: (confidence: ParkedConfidence): string => `Stationné détecté : ${describeConfidence(confidence)}`,
  queueFlushed: (count: number): string => `File vidée : ${count} élément(s)`,
};

export function describeConnectivity(connectivity: Connectivity): string {
  return connectivity === 'offline' ? 'Réseau coupé' : 'Réseau rétabli';
}
