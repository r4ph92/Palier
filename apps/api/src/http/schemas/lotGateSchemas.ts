import type { CreatedGate, DashboardLotGates, GateDeviceKey, GateQrLink } from '@palier/shared-types';
import { EXIT_IDENTIFICATIONS, GATE_INTEGRATION_KINDS, type GateDraft, type GateSettings } from '@palier/shared-types/gateDraft';
import { GATE_KINDS } from '@palier/shared-types/gates';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';
import { uuidSchema } from './uuidSchema.ts';

export const lotGateParametersSchema = {
  type: 'object',
  required: ['id', 'gateId'],
  properties: { id: uuidSchema, gateId: uuidSchema },
} as const;

const boundedText = { type: 'string', maxLength: 4096 } as const;

const gateSettingsProperties = {
  name: boundedText,
  integrationKind: { type: 'string', enum: GATE_INTEGRATION_KINDS },
  endpoint: { anyOf: [boundedText, { type: 'null' }] },
  reportsLoops: { type: 'boolean' },
  exitIdentification: { type: 'string', enum: EXIT_IDENTIFICATIONS },
} as const;

const GATE_SETTINGS_KEYS = ['name', 'integrationKind', 'endpoint', 'reportsLoops', 'exitIdentification'] as const;

// Shape only: the name and the endpoint follow the shared rule, so the dashboard and the API refuse them with the same code.
export const gateSettingsBodySchema = {
  type: 'object',
  required: GATE_SETTINGS_KEYS,
  additionalProperties: false,
  properties: gateSettingsProperties,
} as const;

export const gateDraftBodySchema = {
  type: 'object',
  required: [...GATE_SETTINGS_KEYS, 'kind'],
  additionalProperties: false,
  properties: { ...gateSettingsProperties, kind: { type: 'string', enum: GATE_KINDS } },
} as const;

const dashboardGateSchema = {
  type: 'object',
  required: ['id', 'kind', ...GATE_SETTINGS_KEYS],
  additionalProperties: false,
  properties: { ...gateSettingsProperties, id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string', enum: GATE_KINDS }, endpoint: { type: ['string', 'null'] } },
} as const;

export const dashboardLotGatesSchema = {
  type: 'object',
  required: ['lotId', 'lotName', 'gates'],
  additionalProperties: false,
  properties: { lotId: { type: 'string' }, lotName: { type: 'string' }, gates: { type: 'array', items: dashboardGateSchema } },
} as const;

export const gateDeviceKeySchema = {
  type: 'object',
  required: ['gateId', 'deviceKey'],
  additionalProperties: false,
  properties: { gateId: { type: 'string' }, deviceKey: { type: 'string' } },
} as const;

export const createdGateSchema = {
  type: 'object',
  required: ['gateId', 'deviceKey', 'lotGates'],
  additionalProperties: false,
  properties: { ...gateDeviceKeySchema.properties, lotGates: { anyOf: [dashboardLotGatesSchema, { type: 'null' }] } },
} as const;

export const gateQrLinkSchema = {
  type: 'object',
  required: ['link'],
  additionalProperties: false,
  properties: { link: { type: 'string' } },
} as const;

export type GateSettingsSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof gateSettingsBodySchema>, GateSettings>>;
export type GateDraftSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof gateDraftBodySchema>, GateDraft>>;
export type LotGatesSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardLotGatesSchema>, WithMutableArrays<DashboardLotGates>>>;
export type CreatedGateSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof createdGateSchema>, WithMutableArrays<CreatedGate>>>;
export type GateDeviceKeySchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof gateDeviceKeySchema>, GateDeviceKey>>;
export type GateQrLinkSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof gateQrLinkSchema>, GateQrLink>>;
