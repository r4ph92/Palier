import type { BeaconBatteryReading } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

// A number, not an integer: 1.5 gets the rule's BATTERY_PERCENT_INVALID like 101 does.
export const batteryReadingBodySchema = {
  type: 'object',
  required: ['percent'],
  additionalProperties: false,
  properties: { percent: { type: 'number' } },
} as const;

export type BatteryReadingSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof batteryReadingBodySchema>, BeaconBatteryReading>>;
