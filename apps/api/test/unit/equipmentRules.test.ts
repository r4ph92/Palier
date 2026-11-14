import { describe, expect, it } from 'vitest';
import { BATTERY_READING_LIFETIME_MILLISECONDS, batteryStatusOf } from '../../src/domain/equipment/batteryStatus.ts';
import { gateHealthOf } from '../../src/domain/equipment/gateHealth.ts';

const now = new Date('2026-11-13T19:05:00Z');

function secondsBefore(seconds: number): Date {
  return new Date(now.getTime() - seconds * 1000);
}

describe('the health of a gate', () => {
  it('is never heard before its first heartbeat', () => {
    expect(gateHealthOf(null, now)).toBe('NEVER_HEARD');
  });

  it.each([0, 119, 120])('stays online %i s after its last heartbeat', (seconds) => {
    expect(gateHealthOf(secondsBefore(seconds), now)).toBe('ONLINE');
  });

  it('turns silent past 2 minutes', () => {
    expect(gateHealthOf(secondsBefore(121), now)).toBe('SILENT');
  });
});

describe('the status of a beacon battery', () => {
  const recent = secondsBefore(60);

  it.each([
    [15, 'LOW'],
    [20, 'LOW'],
    [21, 'OK'],
    [0, 'LOW'],
    [100, 'OK'],
  ] as const)('reads %i percent as %s', (percent, status) => {
    expect(batteryStatusOf({ percent, reportedAt: recent }, now)).toBe(status);
  });

  it('is unknown without a reading', () => {
    expect(batteryStatusOf({ percent: null, reportedAt: null }, now)).toBe('UNKNOWN');
  });

  it('trusts a reading exactly 90 days old, and no older one', () => {
    const ninetyDaysAgo = new Date(now.getTime() - BATTERY_READING_LIFETIME_MILLISECONDS);

    expect(batteryStatusOf({ percent: 80, reportedAt: ninetyDaysAgo }, now)).toBe('OK');
    expect(batteryStatusOf({ percent: 80, reportedAt: new Date(ninetyDaysAgo.getTime() - 1) }, now)).toBe('UNKNOWN');
  });
});
