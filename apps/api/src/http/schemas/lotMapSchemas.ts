import type { DashboardLotMap, LevelOrderRequest } from '@palier/shared-types';
import type { AisleRequest } from '@palier/shared-types/aisleDraft';
import type { LevelDraft } from '@palier/shared-types/levelDraft';
import { MAX_LEVELS_PER_LOT } from '@palier/shared-types/levelDraft';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';
import { uuidSchema } from './uuidSchema.ts';

const gridNumber = { type: 'number' } as const;

const rectangleSchema = {
  type: 'object',
  required: ['x', 'y', 'width', 'height'],
  additionalProperties: false,
  properties: { x: gridNumber, y: gridNumber, width: gridNumber, height: gridNumber },
} as const;

export const lotLevelParametersSchema = {
  type: 'object',
  required: ['id', 'levelId'],
  properties: { id: uuidSchema, levelId: uuidSchema },
} as const;

// Shape only: lengths and ranges live in the shared rules, so the dashboard and the API refuse the same values with the same code.
export const levelDraftBodySchema = {
  type: 'object',
  required: ['code'],
  additionalProperties: false,
  properties: { code: { type: 'string', maxLength: 1000 } },
} as const;

const levelIdsSchema = { type: 'array', minItems: 1, maxItems: MAX_LEVELS_PER_LOT, uniqueItems: true, items: uuidSchema } as const;

export const levelOrderBodySchema = {
  type: 'object',
  required: ['levelIds', 'fromLevelIds'],
  additionalProperties: false,
  properties: { levelIds: levelIdsSchema, fromLevelIds: levelIdsSchema },
} as const;

// A number, not an integer, for the minor: 1.5 gets the rule's AISLE_MINOR_INVALID like 0 does.
export const aisleBodySchema = {
  type: 'object',
  required: ['code', 'beaconMinor'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', maxLength: 1000 },
    beaconMinor: { type: 'number' },
    rectangle: { anyOf: [rectangleSchema, { type: 'null' }] },
  },
} as const;

const mapAisleSchema = {
  type: 'object',
  required: ['id', 'code', 'beaconMinor', 'isExitLane', 'rectangle', 'batteryPercent', 'batteryReportedAt', 'batteryStatus'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    beaconMinor: { type: 'integer' },
    isExitLane: { type: 'boolean' },
    rectangle: { anyOf: [rectangleSchema, { type: 'null' }] },
    batteryPercent: { type: ['integer', 'null'] },
    batteryReportedAt: { type: ['string', 'null'] },
    batteryStatus: { type: 'string', enum: ['OK', 'LOW', 'UNKNOWN'] },
  },
} as const;

const mapLevelSchema = {
  type: 'object',
  required: ['id', 'code', 'displayOrder', 'aisles'],
  additionalProperties: false,
  properties: { id: { type: 'string' }, code: { type: 'string' }, displayOrder: { type: 'integer' }, aisles: { type: 'array', items: mapAisleSchema } },
} as const;

export const dashboardLotMapSchema = {
  type: 'object',
  required: ['lotId', 'lotName', 'platformUuid', 'beaconMajor', 'levels'],
  additionalProperties: false,
  properties: {
    lotId: { type: 'string' },
    lotName: { type: 'string' },
    platformUuid: { type: 'string' },
    beaconMajor: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    levels: { type: 'array', items: mapLevelSchema },
  },
} as const;

export type LevelDraftSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof levelDraftBodySchema>, LevelDraft>>;
export type LevelOrderSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof levelOrderBodySchema>, WithMutableArrays<LevelOrderRequest>>>;
export type AisleSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof aisleBodySchema>, AisleRequest>>;
export type LotMapSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardLotMapSchema>, WithMutableArrays<DashboardLotMap>>>;
