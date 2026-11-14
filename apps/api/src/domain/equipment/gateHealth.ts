import type { GateHealth } from '@palier/shared-types';

// Four missed beats of the console's 30 s heartbeat (decision 035).
export const SILENT_AFTER_MILLISECONDS = 2 * 60 * 1000;

export function gateHealthOf(lastHeartbeatAt: Date | null, now: Date): GateHealth {
  if (lastHeartbeatAt === null) {
    return 'NEVER_HEARD';
  }
  return now.getTime() - lastHeartbeatAt.getTime() > SILENT_AFTER_MILLISECONDS ? 'SILENT' : 'ONLINE';
}
