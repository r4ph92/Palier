import type { DashboardErrorCode } from './dashboard.ts';
import { isValidDisplayText } from './displayText.ts';
import { fieldErrorsOf, type FieldErrors } from './fieldErrors.ts';
import type { GateKind } from './gates.ts';

export const GATE_NAME_LENGTH = { minimum: 1, maximum: 60 } as const;
export const GATE_ENDPOINT_MAX_LENGTH = 2048;
export const MAX_GATES_PER_LOT = 50;

// How Palier reaches the barrier: a relay on a dry contact, the access-control system's API, or the demo console.
export const GATE_INTEGRATION_KINDS = ['DRY_CONTACT', 'ACCESS_CONTROL_API', 'SIMULATED'] as const;
export type GateIntegrationKind = (typeof GATE_INTEGRATION_KINDS)[number];

// What an exit gate reads to open for a vehicle without the app: nothing, a plate camera or a transponder reader.
export const EXIT_IDENTIFICATIONS = ['NONE', 'PLATE', 'TRANSPONDER'] as const;
export type ExitIdentification = (typeof EXIT_IDENTIFICATIONS)[number];

// What an operator can change on a gate; its direction is set once, when it is added.
export interface GateSettings {
  readonly name: string;
  readonly integrationKind: GateIntegrationKind;
  // An https address, or null when the gate has none.
  readonly endpoint: string | null;
  readonly reportsLoops: boolean;
  readonly exitIdentification: ExitIdentification;
}

export interface GateDraft extends GateSettings {
  readonly kind: GateKind;
}

export type GateDraftField = 'name' | 'endpoint' | 'exitIdentification';

export type GateDraftErrorCode = Extract<
  DashboardErrorCode,
  'GATE_NAME_REQUIRED' | 'GATE_NAME_INVALID' | 'GATE_ENDPOINT_NOT_HTTPS' | 'GATE_ENDPOINT_REQUIRED' | 'GATE_EXIT_ID_ON_ENTRY'
>;

export type GateDraftErrors = FieldErrors<GateDraftField, GateDraftErrorCode>;

// Spaces and invisible characters never belong in an address; a URL parser would quietly drop some of them.
const UNSAFE_IN_ENDPOINT = /[\s\p{Cc}\p{Cf}]/u;

// The one rule for a new gate, applied by the dashboard before sending and by the API before writing.
export function gateDraftErrors(draft: GateDraft): GateDraftErrors {
  return fieldErrorsOf<GateDraftField, GateDraftErrorCode>([...settingsChecksOf(draft), ['exitIdentification', exitIdentificationErrorOf(draft.kind, draft.exitIdentification)]]);
}

// The rule for a gate already added, whose direction only the stored gate knows: exitIdentificationErrorOf runs once it is read.
export function gateSettingsErrors(settings: GateSettings): GateDraftErrors {
  return fieldErrorsOf<GateDraftField, GateDraftErrorCode>(settingsChecksOf(settings));
}

// An entry gate never identifies a vehicle: the driver's own QR scan does.
export function exitIdentificationErrorOf(kind: GateKind, exitIdentification: ExitIdentification): 'GATE_EXIT_ID_ON_ENTRY' | null {
  return kind === 'ENTRY' && exitIdentification !== 'NONE' ? 'GATE_EXIT_ID_ON_ENTRY' : null;
}

function settingsChecksOf({ name, integrationKind, endpoint }: GateSettings): (readonly [GateDraftField, GateDraftErrorCode | null])[] {
  return [
    ['name', nameErrorOf(name)],
    ['endpoint', endpointErrorOf(integrationKind, endpoint)],
  ];
}

function nameErrorOf(name: string): GateDraftErrorCode | null {
  if (name.trim() === '') {
    return 'GATE_NAME_REQUIRED';
  }
  return isValidDisplayText(name, GATE_NAME_LENGTH) ? null : 'GATE_NAME_INVALID';
}

// Only the access-control API needs an address to be reached; any address given must be https.
function endpointErrorOf(integrationKind: GateIntegrationKind, endpoint: string | null): GateDraftErrorCode | null {
  if (endpoint === null) {
    return integrationKind === 'ACCESS_CONTROL_API' ? 'GATE_ENDPOINT_REQUIRED' : null;
  }
  return isHttpsEndpoint(endpoint) ? null : 'GATE_ENDPOINT_NOT_HTTPS';
}

// An https address with a host and no user name or password in it.
export function isHttpsEndpoint(endpoint: string): boolean {
  if (endpoint.length > GATE_ENDPOINT_MAX_LENGTH || UNSAFE_IN_ENDPOINT.test(endpoint) || !URL.canParse(endpoint)) {
    return false;
  }
  const url = new URL(endpoint);
  return url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === '';
}

// What the form or the API stores for a typed address: trimmed, and empty as none.
export function endpointOf(typed: string): string | null {
  const endpoint = typed.trim();
  return endpoint === '' ? null : endpoint;
}
