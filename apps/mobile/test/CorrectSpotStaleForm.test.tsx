import { screen, userEvent } from '@testing-library/react-native';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { visibleText } from './visibleText';
import { advance, julieWith, PARKED_IN_A1 } from './walkAwayRig';
import { CONFIRM_TYPED } from './whereParkedRig';

const NOT_MY_SPOT = 'Ce n’est pas ma place';
const A2 = { number: 'A-2', levelCode: 'P1', aisleCode: 'A' };

// QA #22: the form open on one session must not come back by itself on a later one.
describe('a correction form left open while the session moves on (story #22, QA)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('keeps the form open across a refresh that still shows Julie presumed in A-1', async () => {
    const { parkingSession } = await julieWith(julieAtParkingDemo({ state: 'PARKED_PRESUMED' }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
    await screen.findByText(PARKED_IN_A1, visibleText);
    await user.press(screen.getByRole('button', { name: NOT_MY_SPOT }));

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByRole('header', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('offers the action, not the form, on the next presumed session of Julie after she corrected the last one', async () => {
    const { parkingSession } = await julieWith(julieAtParkingDemo({ state: 'PARKED_PRESUMED' }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
    await screen.findByText(PARKED_IN_A1, visibleText);
    await user.press(screen.getByRole('button', { name: NOT_MY_SPOT }));
    await user.type(screen.getByLabelText('Numéro de la place où vous êtes garé'), 'A-3');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));
    expect(await screen.findByText('Garé en A-3', visibleText)).toBeOnTheScreen();

    parkingSession.session = julieAtParkingDemo({ sessionId: 'session-2', state: 'PARKED_PRESUMED', spot: A2 });
    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.queryByRole('header', { name: NOT_MY_SPOT })).toBeNull();
    expect(await screen.findByText('Garé en A-2', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: NOT_MY_SPOT })).toBeOnTheScreen();
  });
});
