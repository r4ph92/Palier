import { act, fireEvent, screen } from '@testing-library/react-native';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { visibleText } from './visibleText';
import { advance } from './walkAwayRig';
import { CONFIRM_TYPED, julieCorrecting, NOT_MY_SPOT } from './whereParkedRig';

const A2 = { number: 'A-2', levelCode: 'P1', aisleCode: 'A' };

const SPOT_NUMBER = 'Numéro de la place où vous êtes garé';

describe('the correction form at its edges (story #22)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('offers no way back, button or escape, while « Envoi… » is in flight, then shows « Garé en A-3 »', async () => {
    const { user, parkingSession } = await julieCorrecting();
    parkingSession.holdsSpotAnswer = true;

    await user.type(screen.getByLabelText(SPOT_NUMBER), 'A-3');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByText('Envoi…', visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    await act(async () => fireEvent(screen.getByRole('header', { name: NOT_MY_SPOT }), 'accessibilityEscape'));
    expect(screen.getByRole('header', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    parkingSession.answerSpotAnswers();
    expect(await screen.findByText('Garé en A-3', visibleText)).toBeOnTheScreen();
  });

  it('keeps the form open across a refresh that still shows Julie presumed in A-1', async () => {
    const { parkingSession } = await julieCorrecting();

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByRole('header', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('offers the action, not the form, on the next presumed session of Julie after she corrected the last one', async () => {
    const { user, parkingSession } = await julieCorrecting();
    await user.type(screen.getByLabelText(SPOT_NUMBER), 'A-3');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));
    await screen.findByText('Garé en A-3', visibleText);

    parkingSession.session = julieAtParkingDemo({ sessionId: 'session-2', state: 'PARKED_PRESUMED', spot: A2 });
    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(await screen.findByText('Garé en A-2', visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: NOT_MY_SPOT })).toBeNull();
    expect(screen.getByRole('button', { name: NOT_MY_SPOT })).toBeOnTheScreen();
  });

  it('goes back to « Garé en A-1 » on VoiceOver’s escape gesture, sending nothing', async () => {
    const { parkingSession } = await julieCorrecting();

    await act(async () => fireEvent(screen.getByRole('header', { name: NOT_MY_SPOT }), 'accessibilityEscape'));

    expect(screen.getByText('Garé en A-1', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('shows no offline notice in the form when the minute read fails, and the details show it again after « Annuler »', async () => {
    const { user, parkingSession } = await julieCorrecting();
    parkingSession.failure = new PalierUnreachableError('offline');

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByRole('header', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(screen.queryByText(/^Hors ligne/)).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Hors ligne, montant au dernier relevé')).toBeOnTheScreen();
  });
});
