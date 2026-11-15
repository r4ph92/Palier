import type { DashboardGate, DashboardLotDetails, DashboardLotGates } from '@palier/shared-types';
import { exitIdentificationErrorOf, gateDraftErrors, gateSettingsErrors, MAX_GATES_PER_LOT, type GateDraft, type GateDraftErrors, type GateSettings } from '@palier/shared-types/gateDraft';
import { type FakeApiState, type FakeResponse, refused } from './fakeDashboardData.ts';
import { type FakeGate, qrLinkOf } from './fakeGateData.ts';

const LOT_GATES_REQUEST = /^(GET|POST) \/lots\/([^/]+)\/gates$/;
const GATE_REQUEST = /^(PUT|POST|GET) \/lots\/([^/]+)\/gates\/([^/]+)(\/device-key|\/qr-secret|\/qr-link)?$/;

let nextId = 0;

export function isGateRequest(request: string): boolean {
  return LOT_GATES_REQUEST.test(request) || GATE_REQUEST.test(request);
}

export interface MemberGates {
  readonly state: FakeApiState;
  readonly lots: readonly DashboardLotDetails[];
}

interface MemberLot {
  readonly state: FakeApiState;
  readonly lot: DashboardLotDetails;
}

interface MemberGate extends MemberLot {
  readonly gate: FakeGate;
}

// Keeps the API's rules: a member's own lot, the shared gate rule, one exit gate, names taken in the lot.
export function routeGates({ state, lots }: MemberGates, request: string, body: Record<string, unknown>): FakeResponse {
  const [, method, lotId, gateId, action = ''] = LOT_GATES_REQUEST.exec(request) ?? GATE_REQUEST.exec(request) ?? [];
  const lot = lots.find(({ id }) => id === lotId);
  if (lot === undefined) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  const member = { state, lot };
  if (gateId === undefined) {
    return method === 'GET' ? { status: 200, body: lotGatesOf(member) } : addGate(member, body as unknown as GateDraft);
  }
  const gate = gatesOf(member).find(({ id }) => id === gateId);
  return gate === undefined ? refused(404, 'GATE_NOT_FOUND') : routeGate({ ...member, gate }, `${method}${action}`, body);
}

function routeGate(member: MemberGate, action: string, body: Record<string, unknown>): FakeResponse {
  const { gate } = member;
  if (action === 'POST/device-key') {
    return { status: 200, body: { gateId: gate.id, deviceKey: newDeviceKey() } };
  }
  if (action === 'POST/qr-secret') {
    gate.qrSecret = `secret-${newId()}`;
    return { status: 204 };
  }
  return action === 'GET/qr-link' ? { status: 200, body: { link: qrLinkOf(gate) } } : changeGate(member, body as unknown as GateSettings);
}

function addGate(member: MemberLot, draft: GateDraft): FakeResponse {
  const refusal = firstErrorOf(gateDraftErrors(draft)) ?? limitRefusalOf(gatesOf(member), draft);
  if (refusal !== undefined) {
    return refusal;
  }
  const gate: FakeGate = { ...draft, id: newId(), qrSecret: `secret-${newId()}` };
  gatesOf(member).push(gate);
  return { status: 201, body: { gateId: gate.id, deviceKey: newDeviceKey(), lotGates: lotGatesOf(member) } };
}

function changeGate(member: MemberGate, settings: GateSettings): FakeResponse {
  const { gate } = member;
  const isNameTaken = gatesOf(member).some(({ id, name }) => id !== gate.id && name === settings.name);
  const refusal =
    firstErrorOf(gateSettingsErrors(settings)) ?? refusedWith(400, exitIdentificationErrorOf(gate.kind, settings.exitIdentification)) ?? refusedWith(409, isNameTaken ? 'GATE_NAME_TAKEN' : null);
  if (refusal !== undefined) {
    return refusal;
  }
  Object.assign(gate, settings);
  return { status: 200, body: lotGatesOf(member) };
}

function limitRefusalOf(gates: readonly FakeGate[], draft: GateDraft): FakeResponse | undefined {
  if (gates.length >= MAX_GATES_PER_LOT) {
    return refused(409, 'GATE_LIMIT_REACHED');
  }
  if (draft.kind === 'EXIT' && gates.some(({ kind }) => kind === 'EXIT')) {
    return refused(409, 'GATE_EXIT_LIMIT');
  }
  return gates.some(({ name }) => name === draft.name) ? refused(409, 'GATE_NAME_TAKEN') : undefined;
}

function firstErrorOf(errors: GateDraftErrors): FakeResponse | undefined {
  return refusedWith(400, Object.values(errors).find((found) => found !== undefined) ?? null);
}

function refusedWith(status: number, code: string | null): FakeResponse | undefined {
  return code === null ? undefined : refused(status, code);
}

function gatesOf({ state, lot }: MemberLot): FakeGate[] {
  const gates = state.gates.get(lot.id) ?? [];
  state.gates.set(lot.id, gates);
  return gates;
}

function lotGatesOf(member: MemberLot): DashboardLotGates {
  return { lotId: member.lot.id, lotName: member.lot.name, gates: [...gatesOf(member)].sort(byKindThenName).map(dashboardGateOf) };
}

// The API's order: entries before exits, then by name.
function byKindThenName(first: FakeGate, second: FakeGate): number {
  return first.kind.localeCompare(second.kind) || first.name.localeCompare(second.name);
}

function dashboardGateOf({ id, name, kind, integrationKind, endpoint, reportsLoops, exitIdentification }: FakeGate): DashboardGate {
  return { id, name, kind, integrationKind, endpoint, reportsLoops, exitIdentification };
}

function newDeviceKey(): string {
  return `device-key-${newId()}`.padEnd(43, 'k');
}

function newId(): string {
  nextId += 1;
  return `00000000-0000-4000-8000-${String(900_000_000_000 + nextId)}`;
}
