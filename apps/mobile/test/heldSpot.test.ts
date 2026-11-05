import { heldSpotFrom, holdCountdown, secondsLeft } from '../src/spotHolds/heldSpot';
import { julieHoldAtParkingDemo } from './fakeSpotHoldClient';

const RECEIVED_AT = 1_000_000;

describe('secondsLeft', () => {
  const held = heldSpotFrom(julieHoldAtParkingDemo(), RECEIVED_AT, true);

  it('starts at the 15 minutes the server measured', () => {
    expect(secondsLeft(held, RECEIVED_AT)).toBe(900);
  });

  it('counts down with the device clock, whatever time the device shows', () => {
    expect(secondsLeft(held, RECEIVED_AT + 1_000)).toBe(899);
    expect(secondsLeft(held, RECEIVED_AT + 1_500)).toBe(899);
  });

  it('stays at 0 once the time is up', () => {
    expect(secondsLeft(held, RECEIVED_AT + 900_000)).toBe(0);
    expect(secondsLeft(held, RECEIVED_AT + 2_000_000)).toBe(0);
  });

  it('measures a hold read back later from the server clock, not from when it was taken', () => {
    const readLater = julieHoldAtParkingDemo({ now: new Date(2026, 10, 4, 14, 10).toISOString() });

    expect(secondsLeft(heldSpotFrom(readLater, RECEIVED_AT, false), RECEIVED_AT)).toBe(420);
  });
});

describe('holdCountdown', () => {
  const held = heldSpotFrom(julieHoldAtParkingDemo(), RECEIVED_AT, true);

  it('counts the seconds left while time remains', () => {
    expect(holdCountdown(held, RECEIVED_AT + 1_000)).toEqual({ kind: 'counting', secondsLeft: 899 });
  });

  it('is expired at the very end and after it', () => {
    expect(holdCountdown(held, RECEIVED_AT + 900_000)).toEqual({ kind: 'expired' });
    expect(holdCountdown(held, RECEIVED_AT + 2_000_000)).toEqual({ kind: 'expired' });
  });

  it('never counts more than the server measured when the device time is older than the read', () => {
    expect(holdCountdown(held, RECEIVED_AT - 25_000)).toEqual({ kind: 'counting', secondsLeft: 900 });
  });
});
