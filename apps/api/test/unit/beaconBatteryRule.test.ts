import { describe, expect, it } from 'vitest';
import { beaconBatteryErrors } from '@palier/shared-types/beaconBattery';

describe('the beacon battery reading rule', () => {
  it.each([0, 15, 100])('accepts %i percent', (percent) => {
    expect(beaconBatteryErrors({ percent })).toEqual({});
  });

  it.each([-1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %p percent on the percent field', (percent) => {
    expect(beaconBatteryErrors({ percent })).toEqual({ percent: 'BATTERY_PERCENT_INVALID' });
  });
});
