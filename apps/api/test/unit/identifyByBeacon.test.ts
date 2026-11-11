import { describe, expect, it } from 'vitest';
import { recordVehicleAtExit, reportExitBeacon } from '../../src/domain/exits/identifyByBeacon.ts';
import { PassageRefusedError } from '../../src/domain/gates/PassageRefusedError.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';
import { FakeExits, julieInside } from './fakes/fakeExits.ts';
import { entreeDemo, sortieDemo } from './fakes/gateFixtures.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);
const at2117 = new Date(2026, 10, 4, 21, 17);
const SECOND = 1000;

function setup() {
  const exits = new FakeExits();
  const payments = new FakePaymentAuthorizer();
  exits.add('driver-julie', { ...julieInside(enteredAt), lotId: sortieDemo.lotId, exitGateId: sortieDemo.id });
  exits.add('driver-marc', { ...julieInside(enteredAt), id: 'session-marc', paymentIntentId: 'pi_marc', lotId: sortieDemo.lotId, exitGateId: sortieDemo.id });
  const dependencies = { exits, payments };
  const julieReports = (overrides: { driverId?: string; major?: number } = {}) =>
    reportExitBeacon(dependencies, { sessionId: julieInside(enteredAt).id, driverId: 'driver-julie', major: 1, now: at2117, ...overrides });
  const marcReports = () => reportExitBeacon(dependencies, { sessionId: 'session-marc', driverId: 'driver-marc', major: 1, now: at2117 });
  const vehicleArrives = () => recordVehicleAtExit(dependencies, { gate: sortieDemo, requestedGateId: sortieDemo.id, now: at2117 });
  return { exits, payments, julieReports, marcReports, vehicleArrives };
}

describe('exit by beacon', () => {
  it('captures, opens and identifies "BEACON" when the vehicle comes within 60 s of the report', async () => {
    const { exits, payments, julieReports, vehicleArrives } = setup();

    expect(await julieReports()).toEqual({ outcome: 'waiting' });
    exits.now = 59 * SECOND;
    const arrived = await vehicleArrives();

    expect(arrived).toEqual({ outcome: 'opened' });
    expect(payments.captured).toMatchObject([{ paymentIntentId: 'pi_julie', amountCents: 975 }]);
    expect(exits.closings).toMatchObject([{ exitGateId: sortieDemo.id, identification: 'BEACON', exit: { exitedAt: at2117, capturedCents: 975 } }]);
  });

  it('gives the same result when the vehicle comes first', async () => {
    const { exits, payments, julieReports, vehicleArrives } = setup();

    expect(await vehicleArrives()).toEqual({ outcome: 'waiting' });
    exits.now = 59 * SECOND;

    expect(await julieReports()).toEqual({ outcome: 'opened' });
    expect(payments.captured).toHaveLength(1);
    expect(exits.closings).toMatchObject([{ identification: 'BEACON' }]);
  });

  it('captures nothing and opens nothing when two drivers reported, whichever signal comes last', async () => {
    const { exits, payments, julieReports, marcReports, vehicleArrives } = setup();

    await julieReports();
    await marcReports();
    expect(await vehicleArrives()).toEqual({ outcome: 'fallback' });

    expect(payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('falls back when the second driver reports after the vehicle arrived', async () => {
    const { exits, payments, julieReports, marcReports, vehicleArrives } = setup();

    await julieReports();
    await vehicleArrives();

    expect(await marcReports()).toEqual({ outcome: 'waiting' });
    expect(exits.closings).toHaveLength(1);
    expect(payments.captured).toHaveLength(1);
  });

  it('does not open for a pedestrian: a report with no vehicle on the loop', async () => {
    const { exits, payments, julieReports } = setup();

    expect(await julieReports()).toEqual({ outcome: 'waiting' });
    exits.now = 10 * 60 * SECOND;

    expect(payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('does not open on a beacon report older than 60 s', async () => {
    const { exits, payments, julieReports, vehicleArrives } = setup();

    await julieReports();
    exits.now = 61 * SECOND;

    expect(await vehicleArrives()).toEqual({ outcome: 'waiting' });
    expect(payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('does not open on a vehicle seen more than 60 s before the report', async () => {
    const { exits, payments, julieReports, vehicleArrives } = setup();

    await vehicleArrives();
    exits.now = 61 * SECOND;

    expect(await julieReports()).toEqual({ outcome: 'waiting' });
    expect(exits.closings).toEqual([]);
    expect(payments.captured).toEqual([]);
  });

  it('opens once for one vehicle: a repeated report or vehicle takes nothing more', async () => {
    const { payments, julieReports, vehicleArrives } = setup();

    await julieReports();
    await vehicleArrives();
    await julieReports();
    await vehicleArrives();

    expect(payments.captured).toHaveLength(1);
  });

  it('answers not found when another driver reports the beacon for Julie, and records nothing', async () => {
    const { exits, julieReports, vehicleArrives } = setup();

    expect(await julieReports({ driverId: 'driver-marc' })).toEqual({ outcome: 'not-found' });

    expect(await vehicleArrives()).toEqual({ outcome: 'waiting' });
    expect(exits.closings).toEqual([]);
  });

  it('refuses the beacon of another parking and records nothing', async () => {
    const { exits, julieReports, vehicleArrives } = setup();

    expect(await julieReports({ major: 2 })).toEqual({ outcome: 'wrong-lot' });

    expect(await vehicleArrives()).toEqual({ outcome: 'waiting' });
    expect(exits.closings).toEqual([]);
  });

  it('refuses a report for a session with no entry confirmed, or cancelled', async () => {
    const { exits } = setup();
    exits.add('driver-nina', { ...julieInside(enteredAt), id: 'session-nina', state: 'CREATED' });
    exits.add('driver-omar', { ...julieInside(enteredAt), id: 'session-omar', state: 'CANCELLED' });

    expect(await reportExitBeacon({ exits, payments: null }, { sessionId: 'session-nina', driverId: 'driver-nina', major: 1, now: at2117 })).toEqual({ outcome: 'entry-not-confirmed' });
    expect(await reportExitBeacon({ exits, payments: null }, { sessionId: 'session-omar', driverId: 'driver-omar', major: 1, now: at2117 })).toEqual({ outcome: 'closed' });
  });

  it('does not report a session that already left', async () => {
    const { vehicleArrives, julieReports } = setup();
    await julieReports();
    await vehicleArrives();

    expect(await julieReports()).toEqual({ outcome: 'closed' });
  });

  it('takes nothing and opens nothing when payments are not configured', async () => {
    const { exits } = setup();
    const withoutPayments = { exits, payments: null };
    await reportExitBeacon(withoutPayments, { sessionId: julieInside(enteredAt).id, driverId: 'driver-julie', major: 1, now: at2117 });

    const arrived = await recordVehicleAtExit(withoutPayments, { gate: sortieDemo, requestedGateId: sortieDemo.id, now: at2117 });

    expect(arrived).toEqual({ outcome: 'payments-unavailable' });
    expect(exits.closings).toEqual([]);
  });

  it('refuses a vehicle presence from an entry gate, or from a key that is not the gate of the path', async () => {
    const { exits, payments } = setup();
    const dependencies = { exits, payments };

    await expect(recordVehicleAtExit(dependencies, { gate: entreeDemo, requestedGateId: entreeDemo.id, now: at2117 })).rejects.toThrow(PassageRefusedError);
    await expect(recordVehicleAtExit(dependencies, { gate: sortieDemo, requestedGateId: entreeDemo.id, now: at2117 })).rejects.toMatchObject({ reason: 'GATE_FORBIDDEN' });
  });
});
