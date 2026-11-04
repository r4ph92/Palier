import { describe, expect, it } from 'vitest';
import type { HoldRelease } from '../../src/domain/entries/PaymentAuthorizer.ts';
import { cancelUnconfirmedEntries, releasePendingHolds, type CancellationJob } from '../../src/domain/entries/unconfirmedEntryCancellation.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';
import { FakeUnconfirmedEntryRepository, recordingLog } from './fakes/unconfirmedEntryFakes.ts';

const SECOND = 1000;
const openingWindow = { withinMilliseconds: 60 * SECOND };

function jobWith(payments: FakePaymentAuthorizer | null = new FakePaymentAuthorizer()) {
  const entries = new FakeUnconfirmedEntryRepository();
  const job: CancellationJob = { entries, payments, openingWindow };
  return { entries, job, log: recordingLog() };
}

async function check(job: CancellationJob, log = recordingLog()): Promise<void> {
  await cancelUnconfirmedEntries(job, log);
  await releasePendingHolds(job, log);
}

describe('cancelling entries nobody drove through', () => {
  it('cancels Julie’s entry 61 s after the opening, frees A-1 and releases her 25,00 $ hold', async () => {
    const payments = new FakePaymentAuthorizer();
    const { entries, job, log } = jobWith(payments);
    entries.add('julie', 61 * SECOND);

    await check(job, log);

    expect(entries.session('julie')).toMatchObject({ state: 'CANCELLED', holdReleasePending: false });
    expect(entries.freedSpots).toEqual(['A-1']);
    expect(payments.cancelled).toEqual(['pi_julie']);
    expect(log.lines.map((line) => line.message)).toEqual(['cancelled an entry nobody drove through', 'released the card hold of a cancelled entry']);
  });

  it('leaves an entry opened 59 s ago waiting for its loop', async () => {
    const payments = new FakePaymentAuthorizer();
    const { entries, job } = jobWith(payments);
    entries.add('julie', 59 * SECOND);

    await check(job);

    expect(entries.session('julie')?.state).toBe('CREATED');
    expect(payments.cancelled).toEqual([]);
  });

  it('keeps a session a loop closure confirmed just before the cancellation, and its hold', async () => {
    const payments = new FakePaymentAuthorizer();
    const { entries, job, log } = jobWith(payments);
    const julie = entries.add('julie', 61 * SECOND);
    entries.beforeCancel = () => {
      julie.state = 'ENTRY_CONFIRMED';
    };

    await check(job, log);

    expect(julie.state).toBe('ENTRY_CONFIRMED');
    expect(entries.freedSpots).toEqual([]);
    expect(payments.cancelled).toEqual([]);
    expect(log.lines).toEqual([]);
  });

  it('cancels the other entries when one cancellation fails', async () => {
    const { entries, job, log } = jobWith();
    entries.add('julie', 70 * SECOND);
    entries.add('marc', 65 * SECOND);
    entries.failingCancels.add('julie');

    await cancelUnconfirmedEntries(job, log);

    expect(entries.session('marc')?.state).toBe('CANCELLED');
    expect(log.lines[0]).toMatchObject({ level: 'error', details: { sessionId: 'julie' } });
  });

  it('cancels a session without a hold and releases nothing for it', async () => {
    const payments = new FakePaymentAuthorizer();
    const { entries, job } = jobWith(payments);
    entries.add('julie', 61 * SECOND, null);

    await check(job);

    expect(entries.session('julie')).toMatchObject({ state: 'CANCELLED', holdReleasePending: false });
    expect(payments.cancelled).toEqual([]);
  });
});

describe('releasing the holds of cancelled entries', () => {
  it('cancels the session and frees the spot at once when Stripe is unreachable, then retries at each check until Stripe confirms', async () => {
    const payments = new FakePaymentAuthorizer();
    payments.release = 'failed';
    const { entries, job, log } = jobWith(payments);
    const julie = entries.add('julie', 61 * SECOND);

    await check(job, log);
    expect(julie).toMatchObject({ state: 'CANCELLED', holdReleasePending: true });
    expect(entries.freedSpots).toEqual(['A-1']);
    expect(log.lines[1]).toMatchObject({ level: 'warn', message: 'Stripe did not release the card hold, retried at the next check' });

    await check(job);
    expect(julie).toMatchObject({ holdReleasePending: true, releaseAttempts: 2 });

    payments.release = 'released';
    await check(job);
    expect(julie).toMatchObject({ holdReleasePending: false, releaseAttempts: 3 });
    expect(payments.cancelled).toEqual(['pi_julie']);
  });

  it('stops retrying a hold Stripe can no longer cancel, and says so', async () => {
    const payments = new FakePaymentAuthorizer();
    payments.release = 'gone';
    const { entries, job, log } = jobWith(payments);
    entries.add('julie', 61 * SECOND);

    await check(job, log);
    await check(job);

    expect(entries.session('julie')).toMatchObject({ holdReleasePending: false, releaseAttempts: 1 });
    expect(log.lines[1]).toMatchObject({ level: 'error', details: { sessionId: 'julie', paymentIntentId: 'pi_julie' } });
  });

  it('keeps the hold pending when the authorizer throws unexpectedly', async () => {
    const payments = new FakePaymentAuthorizer();
    payments.cancel = () => Promise.reject(new Error('bug'));
    const { entries, job, log } = jobWith(payments);
    entries.add('julie', 61 * SECOND);

    await check(job, log);

    expect(entries.session('julie')?.holdReleasePending).toBe(true);
    expect(log.lines[1]).toMatchObject({ level: 'error', message: 'releasing a card hold failed, retried at the next check' });
  });

  it('releases five holds per check, least recently attempted first, so failing holds never starve a sixth', async () => {
    const payments = new FakePaymentAuthorizer();
    const { entries, job } = jobWith(payments);
    const failing = new Set(['s1', 's2', 's3', 's4', 's5']);
    payments.cancel = (paymentIntentId: string): Promise<HoldRelease> => Promise.resolve(failing.has(paymentIntentId.slice(3)) ? 'failed' : 'released');
    for (const sessionId of ['s1', 's2', 's3', 's4', 's5', 's6']) {
      entries.add(sessionId, 61 * SECOND);
    }

    await check(job);
    expect(entries.sessions.map((session) => session.releaseAttempts)).toEqual([1, 1, 1, 1, 1, 0]);

    await check(job);
    expect(entries.session('s6')).toMatchObject({ releaseAttempts: 1, holdReleasePending: false });
  });

  it('keeps holds pending and warns once per check with the count when the server has no Stripe key', async () => {
    const { entries, job, log } = jobWith(null);
    entries.add('julie', 61 * SECOND);
    entries.add('marc', 62 * SECOND);

    await check(job, log);

    expect(entries.sessions.map((session) => session.holdReleasePending)).toEqual([true, true]);
    expect(log.lines.filter((line) => line.level === 'warn')).toEqual([
      { level: 'warn', details: { pending: 2 }, message: 'card holds wait for release: the server has no Stripe key' },
    ]);
  });

  it('stays silent without a Stripe key when no hold waits', async () => {
    const { job, log } = jobWith(null);

    await releasePendingHolds(job, log);

    expect(log.lines).toEqual([]);
  });
});
