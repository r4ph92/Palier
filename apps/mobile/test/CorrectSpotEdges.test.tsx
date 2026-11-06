import { act, fireEvent, screen } from '@testing-library/react-native';
import { visibleText } from './visibleText';
import { CONFIRM_TYPED, julieCorrecting, NOT_MY_SPOT } from './whereParkedRig';

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
});
