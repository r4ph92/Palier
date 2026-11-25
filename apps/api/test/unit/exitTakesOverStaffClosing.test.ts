import { describe, expect, it } from 'vitest';
import type { ExitClosing, PendingExitClosing } from '../../src/domain/exits/ExitRepository.ts';
import { PostgresExitRepository } from '../../src/infrastructure/postgres/PostgresExitRepository.ts';
import { appendedSessionEvents } from './fakes/appendedSessionEvents.ts';
import { sortieDemo } from './fakes/gateFixtures.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

// Decision 043, the exit wins: the operator closes Julie's session at its last proof while her exit capture is on the way to Stripe.
const SESSION_ID = '00000000-0000-4000-8000-000000000975';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const TAPPED_AT = new Date('2026-11-21T21:17:00Z');

const julieTaps: ExitClosing = {
  sessionId: SESSION_ID,
  lotId: sortieDemo.lotId,
  exitGateId: sortieDemo.id,
  identification: 'APP',
  exit: { exitedAt: TAPPED_AT, capturedCents: 2500, surplusPaidCents: 17575, unpaidCents: 0 },
  capturedAt: TAPPED_AT,
};

const julieTapsWhileStripeIsDown: PendingExitClosing = {
  sessionId: SESSION_ID,
  lotId: sortieDemo.lotId,
  exitGateId: sortieDemo.id,
  identification: 'APP',
  exitedAt: TAPPED_AT,
  pendingCaptureCents: 2500,
  pendingSurplusCents: 17575,
};

function closedByStaffBefore(closeLabel: 'close-paid-session' | 'close-pending-session'): ScriptedSql {
  return new ScriptedSql()
    .answer(closeLabel, [{ assigned_spot_id: SPOT_A1_ID, confirmed_spot_id: null, was_closed_by_staff: true }])
    .answer('insert-gate-command', [{ id: 'command-exit' }]);
}

function kindsOf(scripted: ScriptedSql): unknown[] {
  return appendedSessionEvents(scripted).map(({ kind }) => kind);
}

describe('an exit whose capture went out before an operator closed the session at its last proof (decision 043)', () => {
  it.each([
    ['close-paid-session', (repository: PostgresExitRepository) => repository.close(julieTaps)],
    ['close-pending-session', (repository: PostgresExitRepository) => repository.closeWithPendingCapture(julieTapsWhileStripeIsDown)],
  ] as const)('lets %s take a session closed by staff, and stops the job cancelling its hold', async (label, closeWith) => {
    const scripted = closedByStaffBefore(label);

    await closeWith(new PostgresExitRepository(scripted.database()));

    const text = scripted.statement(label)?.text ?? '';
    expect(text).toMatch(/where id = \$\d+ and state in \('ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED', 'CLOSED_BY_STAFF'\)/);
    expect(text).toMatch(/hold_release_pending = false/);
    expect(text).toMatch(/with previous as \(select state from parking_session where id = \$\d+\)/);
    expect(text).not.toMatch(/staff_closed_by/);
  });

  it('records what Stripe took, logs the exit and opens the barrier, with the receipt of the tap', async () => {
    const scripted = closedByStaffBefore('close-paid-session');

    const closed = await new PostgresExitRepository(scripted.database()).close(julieTaps);

    expect(closed).toEqual({ outcome: 'closed', exit: julieTaps.exit });
    expect(scripted.statement('close-paid-session')?.params).toEqual(expect.arrayContaining([2500, 17575, 0]));
    expect(kindsOf(scripted)).toEqual(['EXIT_IDENTIFIED', 'CAPTURED', 'GATE_OPENED']);
    expect(scripted.count('insert-gate-command')).toBe(1);
    expect(scripted.count('read-paid-exit')).toBe(0);
  });

  it('opens the barrier with the capture pending when Stripe could not confirm it', async () => {
    const scripted = closedByStaffBefore('close-pending-session');

    await expect(new PostgresExitRepository(scripted.database()).closeWithPendingCapture(julieTapsWhileStripeIsDown)).resolves.toEqual({ outcome: 'closed' });

    expect(kindsOf(scripted)).toEqual(['EXIT_IDENTIFIED', 'CAPTURE_PENDING', 'GATE_OPENED']);
    expect(scripted.count('insert-gate-command')).toBe(1);
  });

  it('leaves the spots the operator already freed and flagged: another car may hold them now', async () => {
    const scripted = closedByStaffBefore('close-paid-session');

    await new PostgresExitRepository(scripted.database()).close(julieTaps);

    expect(scripted.count('lock-exit-spots')).toBe(0);
    expect(scripted.count('free-exit-spots')).toBe(0);
  });

  it('still frees the spot of a session nobody closed', async () => {
    const scripted = new ScriptedSql()
      .answer('close-paid-session', [{ assigned_spot_id: SPOT_A1_ID, confirmed_spot_id: null, was_closed_by_staff: false }])
      .answer('lock-exit-spots', [{ id: SPOT_A1_ID, state: 'OCCUPIED', held_by_another_session: false }])
      .answer('insert-gate-command', [{ id: 'command-exit' }]);

    await new PostgresExitRepository(scripted.database()).close(julieTaps);

    expect(scripted.count('free-exit-spots')).toBe(1);
  });
});
