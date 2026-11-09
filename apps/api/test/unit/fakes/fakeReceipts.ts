import type { PaidSession, ReceiptRepository } from '../../../src/domain/receipts/ReceiptRepository.ts';

// Paid sessions per driver, as the Postgres query returns them: only the driver's own, newest exit first.
export class FakeReceipts implements ReceiptRepository {
  readonly #sessions: { readonly driverId: string; readonly session: PaidSession }[] = [];

  add(driverId: string, session: PaidSession): void {
    this.#sessions.push({ driverId, session });
  }

  listPaidSessions(driverId: string): Promise<PaidSession[]> {
    const own = this.#sessions.filter((entry) => entry.driverId === driverId).map((entry) => entry.session);
    return Promise.resolve(own.sort((a, b) => b.exit.exitedAt.getTime() - a.exit.exitedAt.getTime()));
  }

  findPaidSession(sessionId: string, driverId: string): Promise<PaidSession | null> {
    return Promise.resolve(this.#sessions.find((entry) => entry.driverId === driverId && entry.session.id === sessionId)?.session ?? null);
  }
}
