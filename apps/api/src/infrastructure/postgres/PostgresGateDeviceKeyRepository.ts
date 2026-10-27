import { eq } from 'drizzle-orm';
import type { DeviceKeyRecord, GateDeviceKeyRepository } from '../../domain/gates/GateDeviceKeyRepository.ts';
import type { Database } from './database.ts';
import { gate, gateDeviceKey, parkingLot } from './schema.ts';

export class PostgresGateDeviceKeyRepository implements GateDeviceKeyRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findByKeyHash(keyHash: string): Promise<DeviceKeyRecord | undefined> {
    const rows = await this.#database
      .select({
        revokedAt: gateDeviceKey.revokedAt,
        gate: {
          id: gate.id,
          lotId: gate.lotId,
          lotName: parkingLot.name,
          name: gate.name,
          kind: gate.kind,
          hasLoops: gate.hasLoops,
        },
      })
      .from(gateDeviceKey)
      .innerJoin(gate, eq(gate.id, gateDeviceKey.gateId))
      .innerJoin(parkingLot, eq(parkingLot.id, gate.lotId))
      .where(eq(gateDeviceKey.keyHash, keyHash))
      .limit(1);
    return rows[0];
  }
}
