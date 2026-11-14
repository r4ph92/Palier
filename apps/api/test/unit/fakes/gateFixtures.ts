import type { GateCommand } from '@palier/shared-types';
import type { AuthenticatedGate } from '../../../src/domain/gates/AuthenticatedGate.ts';
import { GATE_COMMAND_PAGE_SIZE, type GateCommandCursor, type GateCommandFeed } from '../../../src/domain/gates/GateCommandFeed.ts';
import type { BeaconBatteryReport, EquipmentReports, ReportingGate } from '../../../src/domain/equipment/EquipmentReports.ts';
import type { DeviceKeyRecord, GateDeviceKeyRepository } from '../../../src/domain/gates/GateDeviceKeyRepository.ts';
import { hashDeviceKey } from '../../../src/domain/gates/hashDeviceKey.ts';
import type { PassageEntry, PassageLedger, RecordedPassage, RecordedReplay, ReplayedPassage, ReplayEntry } from '../../../src/domain/gates/PassageLedger.ts';

export const ENTREE_DEMO_KEY = 'entreeDemoKey000000000000000000000000000000';
export const SORTIE_DEMO_KEY = 'sortieDemoKey000000000000000000000000000000';
export const REVOKED_KEY = 'revokedDemoKey00000000000000000000000000000';
export const UNKNOWN_KEY = 'unknownDemoKey00000000000000000000000000000';

export const entreeDemo: AuthenticatedGate = {
  id: '00000000-0000-4000-8000-000000000701',
  lotId: '00000000-0000-4000-8000-000000000201',
  lotName: 'Parking Démo',
  name: 'Entrée Démo',
  kind: 'ENTRY',
  hasLoops: true,
  exitIdKind: 'NONE',
};

export const sortieDemo: AuthenticatedGate = {
  ...entreeDemo,
  id: '00000000-0000-4000-8000-000000000702',
  name: 'Sortie Démo',
  kind: 'EXIT',
  exitIdKind: 'ANPR',
};

export class FakeGateDeviceKeyRepository implements GateDeviceKeyRepository {
  readonly #records = new Map<string, DeviceKeyRecord>([
    [hashDeviceKey(ENTREE_DEMO_KEY), { gate: entreeDemo, revokedAt: null }],
    [hashDeviceKey(SORTIE_DEMO_KEY), { gate: sortieDemo, revokedAt: null }],
    [hashDeviceKey(REVOKED_KEY), { gate: entreeDemo, revokedAt: new Date('2026-10-15T12:00:00Z') }],
  ]);

  findByKeyHash(keyHash: string): Promise<DeviceKeyRecord | undefined> {
    return Promise.resolve(this.#records.get(keyHash));
  }

  withGate(deviceKey: string, gate: AuthenticatedGate): this {
    this.#records.set(hashDeviceKey(deviceKey), { gate, revokedAt: null });
    return this;
  }
}

export class FakePassageLedger implements PassageLedger {
  readonly entries: PassageEntry[] = [];
  // Sessions whose opening waits at the entry gate, oldest first: one closure confirms the first.
  readonly pendingOpenings: string[] = [];
  // Paid sessions whose exit opening waits at the exit gate, oldest first: one closure attaches the first.
  readonly pendingExits: string[] = [];
  // What a replay recorded, for the tests to read back; ids already seen per gate are the unique index.
  readonly replayed: { gateId: string; passage: ReplayedPassage }[] = [];
  vehicleCount: number;

  constructor(vehicleCount = 0) {
    this.vehicleCount = vehicleCount;
  }

  recordPassage(entry: PassageEntry): Promise<RecordedPassage> {
    this.entries.push(entry);
    this.vehicleCount = Math.max(this.vehicleCount + entry.vehicleCountChange, 0);
    const confirmedSessionId = entry.confirmableOpenings === null ? null : (this.pendingOpenings.shift() ?? null);
    const exitedSessionId = entry.attachableOpenings === null ? null : (this.pendingExits.shift() ?? null);
    return Promise.resolve({ vehicleCount: this.vehicleCount, confirmedSessionId, exitedSessionId });
  }

  recordReplay(entry: ReplayEntry): Promise<RecordedReplay> {
    const fresh = entry.passages.filter((passage) => !this.replayed.some((seen) => seen.gateId === entry.gate.id && seen.passage.id === passage.id));
    this.replayed.push(...fresh.map((passage) => ({ gateId: entry.gate.id, passage })));
    this.vehicleCount = Math.max(this.vehicleCount + entry.vehicleCountChange * fresh.length, 0);
    return Promise.resolve({ counted: fresh.length, duplicates: entry.passages.length - fresh.length, vehicleCount: this.vehicleCount });
  }
}

// Mirrors PostgresGateCommandFeed: strictly after the cursor, ordered by time then id, the latest page without one.
export class FakeGateCommandFeed implements GateCommandFeed {
  readonly #commands: { gateId: string; command: GateCommand }[] = [];

  add(gateId: string, command: GateCommand): this {
    this.#commands.push({ gateId, command });
    return this;
  }

  listCommands(gateId: string, after: GateCommandCursor | null): Promise<readonly GateCommand[]> {
    const ordered = this.#commands
      .filter((entry) => entry.gateId === gateId)
      .map((entry) => entry.command)
      .sort((left, right) => left.issuedAt.localeCompare(right.issuedAt) || left.id.localeCompare(right.id));
    if (after === null) {
      return Promise.resolve(ordered.slice(-GATE_COMMAND_PAGE_SIZE));
    }
    return Promise.resolve(ordered.filter((command) => isAfter(command, after)).slice(0, GATE_COMMAND_PAGE_SIZE));
  }
}

function isAfter(command: GateCommand, cursor: GateCommandCursor): boolean {
  const issuedAt = new Date(command.issuedAt).getTime();
  return issuedAt > cursor.issuedAt.getTime() || (issuedAt === cursor.issuedAt.getTime() && command.id > cursor.id);
}

// Parking Démo's beacons as seeded: the exit lane (minor 0), aisles A (1) and B (2); the SQL scopes each write to the gate's lot.
export class FakeEquipmentReports implements EquipmentReports {
  readonly heartbeats = new Map<string, Date>();
  readonly batteries: BeaconBatteryReport[] = [];
  readonly beaconMinorsByLot = new Map<string, readonly number[]>([[entreeDemo.lotId, [0, 1, 2]]]);

  recordHeartbeat(gate: ReportingGate, at: Date): Promise<void> {
    this.heartbeats.set(gate.id, at);
    return Promise.resolve();
  }

  recordBeaconBattery(report: BeaconBatteryReport): Promise<boolean> {
    const isKnown = this.beaconMinorsByLot.get(report.lotId)?.includes(report.beaconMinor) ?? false;
    if (isKnown) {
      this.batteries.push(report);
    }
    return Promise.resolve(isKnown);
  }
}
