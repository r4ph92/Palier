import type { GateHealth } from '@palier/shared-types';
import { SILENT_GATE_AFTER_MINUTES } from '@palier/shared-types/gates';

const MILLISECONDS_PER_MINUTE = 60 * 1000;

export const SILENT_AFTER_MILLISECONDS = SILENT_GATE_AFTER_MINUTES * MILLISECONDS_PER_MINUTE;

export function gateHealthOf(lastHeartbeatAt: Date | null, now: Date): GateHealth {
  if (lastHeartbeatAt === null) {
    return 'NEVER_HEARD';
  }
  return now.getTime() - lastHeartbeatAt.getTime() > SILENT_AFTER_MILLISECONDS ? 'SILENT' : 'ONLINE';
}
