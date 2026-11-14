import type { AisleDraft, DashboardLotMap, DashboardMapLevel, LevelOrderRequest } from '@palier/shared-types';
import { beaconBatteryErrors } from '@palier/shared-types/beaconBattery';
import { type FakeResponse, refused } from './fakeDashboardData.ts';
import { NO_BATTERY_READING } from './fakeMapData.ts';

const MAP_REQUEST = /^(GET|POST|PUT) \/lots\/([^/]+)\/(map|levels|levels\/order|levels\/([^/]+)\/aisles|aisles\/([^/]+)\/beacon-battery)$/;
const LOW_BATTERY_PERCENT = 20;
// What the fake API stamps on a reading, so a test can read the time the page shows.
export const FAKE_READING_TIME = '2026-11-13T19:05:00.000Z';
const STATUS_BY_REFUSAL: Readonly<Record<string, number>> = { LEVEL_NOT_FOUND: 404, AISLE_NOT_FOUND: 404, BATTERY_PERCENT_INVALID: 400 };

let nextId = 0;

function newId(): string {
  nextId += 1;
  return `00000000-0000-4000-8000-${String(900_000_000_000 + nextId)}`;
}

export function isMapRequest(request: string): boolean {
  return MAP_REQUEST.test(request);
}

// Keeps the API's rules on a member's own maps: codes and minors taken, a full order, the exit lane with the first level.
export interface MemberMaps {
  readonly maps: Map<string, DashboardLotMap>;
  readonly ownedLotIds: ReadonlySet<string>;
}

export function routeMap({ maps, ownedLotIds }: MemberMaps, request: string, body: Record<string, unknown>): FakeResponse {
  const [, method, lotId = '', resource, levelId = '', aisleId = ''] = MAP_REQUEST.exec(request) ?? [];
  const map = ownedLotIds.has(lotId) ? maps.get(lotId) : undefined;
  if (map === undefined) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  const changed = changedMap(map, `${method} ${resource}`, { body, levelId, aisleId });
  if (typeof changed === 'string') {
    return refused(STATUS_BY_REFUSAL[changed] ?? 409, changed);
  }
  maps.set(lotId, changed);
  return { status: 200, body: changed };
}

interface MapChange {
  readonly body: Record<string, unknown>;
  readonly levelId: string;
  readonly aisleId: string;
}

function changedMap(map: DashboardLotMap, request: string, { body, levelId, aisleId }: MapChange): DashboardLotMap | string {
  if (request.startsWith('PUT aisles/')) {
    return withBattery(map, aisleId, Number(body['percent']));
  }
  if (request === 'POST levels') {
    return withLevel(map, String(body['code']));
  }
  if (request === 'PUT levels/order') {
    return reordered(map, body as unknown as LevelOrderRequest);
  }
  return request.startsWith('POST levels/') ? withAisle(map, levelId, body as unknown as AisleDraft) : map;
}

function withLevel(map: DashboardLotMap, code: string): DashboardLotMap | string {
  if (map.levels.some((level) => level.code === code)) {
    return 'LEVEL_CODE_TAKEN';
  }
  const exitLane = { id: newId(), code: 'Sortie', beaconMinor: 0, isExitLane: true, rectangle: null, ...NO_BATTERY_READING };
  const level: DashboardMapLevel = { id: newId(), code, displayOrder: map.levels.length + 1, aisles: map.levels.length === 0 ? [exitLane] : [] };
  return { ...map, levels: [...map.levels, level] };
}

function reordered(map: DashboardLotMap, { levelIds, fromLevelIds }: LevelOrderRequest): DashboardLotMap | string {
  const levels = levelIds.map((id) => map.levels.find((level) => level.id === id));
  const isStale = fromLevelIds.join() !== map.levels.map(({ id }) => id).join();
  if (isStale || levels.length !== map.levels.length || levels.some((level) => level === undefined)) {
    return 'LEVEL_ORDER_INVALID';
  }
  return { ...map, levels: levels.map((level, index) => ({ ...(level as DashboardMapLevel), displayOrder: index + 1 })) };
}

function withAisle(map: DashboardLotMap, levelId: string, aisle: AisleDraft): DashboardLotMap | string {
  const level = map.levels.find(({ id }) => id === levelId);
  if (level === undefined) {
    return 'LEVEL_NOT_FOUND';
  }
  if (level.aisles.some(({ code }) => code === aisle.code)) {
    return 'AISLE_CODE_TAKEN';
  }
  if (map.levels.some(({ aisles }) => aisles.some(({ beaconMinor }) => beaconMinor === aisle.beaconMinor))) {
    return 'AISLE_MINOR_TAKEN';
  }
  const added = { id: newId(), ...aisle, isExitLane: false, ...NO_BATTERY_READING };
  const levels = map.levels.map((level) => (level.id === levelId ? { ...level, aisles: [added, ...level.aisles] } : level));
  return { ...map, levels };
}

function withBattery(map: DashboardLotMap, aisleId: string, percent: number): DashboardLotMap | string {
  if (beaconBatteryErrors({ percent }).percent !== undefined) {
    return 'BATTERY_PERCENT_INVALID';
  }
  if (!map.levels.some(({ aisles }) => aisles.some(({ id }) => id === aisleId))) {
    return 'AISLE_NOT_FOUND';
  }
  const reading = { batteryPercent: percent, batteryReportedAt: FAKE_READING_TIME, batteryStatus: percent <= LOW_BATTERY_PERCENT ? 'LOW' : 'OK' } as const;
  const levels = map.levels.map((level) => ({ ...level, aisles: level.aisles.map((aisle) => (aisle.id === aisleId ? { ...aisle, ...reading } : aisle)) }));
  return { ...map, levels };
}
