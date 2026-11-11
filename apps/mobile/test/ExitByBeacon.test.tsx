import { screen } from '@testing-library/react-native';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { BEACON_POLL_MILLISECONDS, BEACON_REPORT_AGAIN_MILLISECONDS } from '../src/parkingSessions/useExitByBeacon';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { FakeReceiptClient, julieReceipt } from './fakeReceiptClient';
import { visibleText } from './visibleText';
import { advance, julieWith } from './walkAwayRig';

const FRENCH_RECEIPT = 'Durée 3 h 15 · 13 × 0,75 $ · Total 9,75 $';
const FALLBACK_FR = 'Touchez « Ouvrir » pour sortir';
const FALLBACK_EN = 'Tap "Open" to leave';
const EXIT_LANE = 0;

async function julieAtTheBeacon(session = julieAtParkingDemo(), language: 'fr' | 'en' = 'fr') {
  const receipts = new FakeReceiptClient();
  const rig = await julieWith(session, language, receipts);
  return { ...rig, receipts };
}

describe('leaving by the exit beacon (story #49)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 21, 17) }));
  afterEach(() => jest.useRealTimers());

  it('reports the exit beacon with the lot major when the device sees the exit lane', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon();

    await enterAisle(EXIT_LANE);

    expect(parkingSession.exitBeaconReports).toEqual([{ sessionId: 'session-1', major: 1 }]);
  });

  it('shows the receipt without a tap once Palier has closed the session', async () => {
    const { parkingSession, receipts, enterAisle } = await julieAtTheBeacon();
    await enterAisle(EXIT_LANE);
    receipts.add(julieReceipt());
    parkingSession.session = null;

    await advance(BEACON_POLL_MILLISECONDS);

    expect(await screen.findByText(FRENCH_RECEIPT, visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Barrière de sortie ouverte' })).toBeOnTheScreen();
  });

  it('says the barrier is open when the receipt is not readable yet', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon();
    await enterAisle(EXIT_LANE);
    parkingSession.session = null;

    await advance(BEACON_POLL_MILLISECONDS);

    expect(await screen.findByRole('header', { name: 'Barrière ouverte — votre reçu suivra' })).toBeOnTheScreen();
  });

  it('keeps the session and reads it again while no vehicle is at the barrier', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon();
    await enterAisle(EXIT_LANE);
    const reads = parkingSession.requests;

    await advance(BEACON_POLL_MILLISECONDS * 2);

    expect(parkingSession.requests).toBeGreaterThan(reads);
    expect(screen.getByRole('button', { name: 'Ouvrir la barrière de sortie' })).toBeOnTheScreen();
  });

  it('reports the beacon once for a burst of sightings, and again later', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon();

    await enterAisle(EXIT_LANE);
    await enterAisle(EXIT_LANE);
    expect(parkingSession.exitBeaconReports).toHaveLength(1);
    await advance(BEACON_REPORT_AGAIN_MILLISECONDS);
    await enterAisle(EXIT_LANE);

    expect(parkingSession.exitBeaconReports).toHaveLength(2);
  });

  it('does not report an aisle of the plan', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon();

    await enterAisle(1);

    expect(parkingSession.exitBeaconReports).toEqual([]);
  });

  it('keeps the tap when Palier refuses the report', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon();
    parkingSession.exitBeaconFailure = new PalierRejectedError('BEACON_NOT_THIS_LOT');

    await enterAisle(EXIT_LANE);

    expect(parkingSession.exitBeaconReports).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ouvrir la barrière de sortie' })).toBeOnTheScreen();
  });

  it('does not report for a session the entry loop has not confirmed', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon(julieAtParkingDemo({ state: 'CREATED' }));

    await enterAisle(EXIT_LANE);

    expect(parkingSession.exitBeaconReports).toEqual([]);
  });

  it('does not report without a beacon major', async () => {
    const { parkingSession, enterAisle } = await julieAtTheBeacon(julieAtParkingDemo({ beaconMajor: null }));

    await enterAisle(EXIT_LANE);

    expect(parkingSession.exitBeaconReports).toEqual([]);
  });

  describe('when two apps reported the beacon', () => {
    it('tells Julie to tap « Ouvrir »', async () => {
      await julieAtTheBeacon(julieAtParkingDemo({ exitBeaconFallback: true }));

      expect(screen.getByText(FALLBACK_FR, visibleText)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Ouvrir la barrière de sortie' })).toBeOnTheScreen();
    });

    it('says it in English on an English device', async () => {
      await julieAtTheBeacon(julieAtParkingDemo({ exitBeaconFallback: true }), 'en');

      expect(screen.getByText(FALLBACK_EN, visibleText)).toBeOnTheScreen();
    });

    it('says nothing otherwise', async () => {
      await julieAtTheBeacon();

      expect(screen.queryByText(FALLBACK_FR, visibleText)).toBeNull();
    });
  });
});
