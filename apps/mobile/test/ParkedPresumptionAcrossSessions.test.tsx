import { act, screen } from '@testing-library/react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { julieAtB3, julieAtParkingDemo } from './fakeParkingSessionClient';
import { visibleText } from './visibleText';
import { advance, GO_TO_A1, julieWith, PARKED_IN_A1 } from './walkAwayRig';

describe('walking away across sessions and aisles (story #18)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('presumes B-3 when Julie, sent to aisle B (story #17), walks away in aisle B', async () => {
    const { walkAway, enterAisle, parkingSession } = await julieWith(julieAtB3());
    await enterAisle(2);

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(1);
    expect(await screen.findByText('Garé en B-3', visibleText)).toBeOnTheScreen();
  });

  it('presumes A-1 when Julie crossed aisle B but walked away back in aisle A', async () => {
    const { walkAway, enterAisle, parkingSession } = await julieWith(julieAtParkingDemo());
    await enterAisle(1);
    await enterAisle(2);
    await enterAisle(1);

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(1);
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
  });

  it.each([
    ['fr', PARKED_IN_A1],
    ['en', 'Parked in A-1'],
  ] as const)('shows a session already presumed parked at launch without guidance, and sends nothing on a walk (%s)', async (language, parkedText) => {
    const { walkAway, parkingSession, keepAliveCommands } = await julieWith(julieAtParkingDemo({ state: 'PARKED_PRESUMED' }), language);

    await walkAway();

    expect(screen.getByText(parkedText, visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(GO_TO_A1, visibleText)).toBeNull();
    expect(screen.queryByText(/Go to aisle A/, visibleText)).toBeNull();
    expect(parkingSession.parkedReports).toHaveLength(0);
    expect(keepAliveCommands()).toEqual([]);
  });

  it('sends a later walk when the first one was lost for lack of network', async () => {
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());
    parkingSession.parkedFailure = new PalierUnreachableError('offline');
    await walkAway();
    parkingSession.parkedFailure = null;

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(2);
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
  });

  it('sends no keep-alive stop for an answer that lands after the session changed', async () => {
    const { walkAway, parkingSession, keepAliveCommands } = await julieWith(julieAtParkingDemo());
    parkingSession.holdsParkedAnswer = true;
    await walkAway();
    parkingSession.session = julieAtParkingDemo({ sessionId: 'session-2' });
    await advance(SESSION_REFRESH_MILLISECONDS);

    await act(async () => parkingSession.answerParked());

    expect(keepAliveCommands()).toEqual([]);
    expect(screen.getByText(GO_TO_A1, visibleText)).toBeOnTheScreen();
  });

  it('reports the walk of the next session once the presumed one has ended', async () => {
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());
    await walkAway();
    await screen.findByText(PARKED_IN_A1, visibleText);
    parkingSession.session = null;
    await advance(SESSION_REFRESH_MILLISECONDS);
    parkingSession.session = julieAtParkingDemo({ sessionId: 'session-2' });
    await advance(SESSION_REFRESH_MILLISECONDS);
    await screen.findByText(GO_TO_A1, visibleText);

    await walkAway();

    expect(parkingSession.parkedReports.map((report) => report.sessionId)).toEqual(['session-1', 'session-2']);
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
  });
});
