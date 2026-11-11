import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { asSeen, visibleText } from './visibleText';
import { advance, julieWith } from './walkAwayRig';
import { julieAskedInAisleB, NOT_MY_SPOT, WHERE_PARKED } from './whereParkedRig';

// Story #24: Palier presumes the assigned spot after 30 silent minutes; the app learns it from the minute read only.
describe('a session presumed parked after 30 silent minutes (story #24)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('drops a half-typed answer for the presumed A-1 and sends nothing when the question times out', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();
    await user.type(screen.getByLabelText('Numéro de place'), 'B-');
    parkingSession.session = julieAtParkingDemo({ state: 'PARKED_PRESUMED' });

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.queryByText(WHERE_PARKED, visibleText)).toBeNull();
    expect(screen.getByText('Garé en A-1', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('never announces « Garé en A-1 » as if Julie had walked to it when her unanswered question times out', async () => {
    const { parkingSession } = await julieAskedInAisleB();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    parkingSession.session = julieAtParkingDemo({ state: 'PARKED_PRESUMED' });

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByText('Garé en A-1', visibleText)).toBeOnTheScreen();
    expect(announce.mock.calls.filter(([message]) => asSeen(message) === 'Garé en A-1')).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the presumed spot and its correction in English once the question times out', async () => {
    const { parkingSession } = await julieAskedInAisleB('en');
    parkingSession.session = julieAtParkingDemo({ state: 'PARKED_PRESUMED' });

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.queryByText('Where are you parked?', visibleText)).toBeNull();
    expect(screen.getByText('Parked in A-1', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'This is not my spot' })).toBeOnTheScreen();
  });

  it('turns a confirmed entry that never sent a walk into the presumed A-1, with its correction offered', async () => {
    const { parkingSession } = await julieWith(julieAtParkingDemo());
    parkingSession.session = julieAtParkingDemo({ state: 'PARKED_PRESUMED' });

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByText('Garé en A-1', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toEqual([]);
  });
});
