import { describe, expect, it } from 'vitest';
import { recordHeartbeat } from '../../src/domain/equipment/recordHeartbeat.ts';
import { reportBeaconBattery } from '../../src/domain/equipment/reportBeaconBattery.ts';
import { GateForbiddenError } from '../../src/domain/gates/GateForbiddenError.ts';
import { entreeDemo, FakeEquipmentReports, sortieDemo } from './fakes/gateFixtures.ts';

const now = new Date('2026-11-13T19:05:00Z');

describe("a device key on another gate's path", () => {
  it('refuses the heartbeat with the gate-level refusal, not a passage one, and stamps nothing', async () => {
    const reports = new FakeEquipmentReports();

    await expect(recordHeartbeat({ gate: entreeDemo, requestedGateId: sortieDemo.id }, { reports, clock: () => now })).rejects.toBeInstanceOf(GateForbiddenError);
    expect(reports.heartbeats.size).toBe(0);
  });

  it('refuses the battery report the same way before looking at the percent, and writes nothing', async () => {
    const reports = new FakeEquipmentReports();
    const command = { gate: entreeDemo, requestedGateId: sortieDemo.id, beaconMinor: 1, percent: 500 };

    await expect(reportBeaconBattery(command, { reports, clock: () => now })).rejects.toMatchObject({ reason: 'GATE_FORBIDDEN' });
    expect(reports.batteries).toEqual([]);
  });
});
