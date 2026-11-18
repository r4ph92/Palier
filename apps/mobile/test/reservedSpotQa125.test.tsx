import { screen } from '@testing-library/react-native';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { visibleText } from './visibleText';
import { CONFIRM_TYPED, julieAskedInAisleB, juliePresumedInA1, REFUSAL_MESSAGES, WHERE_PARKED } from './whereParkedRig';

const RESERVED_EN = 'This spot is reserved — check the number on the ground';

describe('the reserved-spot refusal in the app (QA story #125)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('places Julie in B-3 after the refusal of B-5, and drops the refusal', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();
    parkingSession.answerFailure = new PalierRejectedError('SPOT_NOT_SUITABLE');
    await user.type(screen.getByLabelText('Numéro de place'), 'B-5');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));
    await screen.findByText(REFUSAL_MESSAGES.SPOT_NOT_SUITABLE, visibleText);
    parkingSession.answerFailure = null;

    await user.press(screen.getByRole('radio', { name: 'B-3' }));
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByText('Garé en B-3', visibleText)).toBeOnTheScreen();
    expect(parkingSession.spotAnswers).toEqual(['B-5', 'B-3']);
    expect(screen.queryByText(REFUSAL_MESSAGES.SPOT_NOT_SUITABLE, visibleText)).toBeNull();
    expect(screen.queryByRole('header', { name: WHERE_PARKED })).toBeNull();
  });

  it('reads the reserved-spot refusal of a correction on an English device, and keeps the form', async () => {
    const { user, parkingSession } = await juliePresumedInA1('en');
    await user.press(screen.getByRole('button', { name: 'This is not my spot' }));
    parkingSession.answerFailure = new PalierRejectedError('SPOT_NOT_SUITABLE');

    await user.type(screen.getByLabelText('Number of the spot you parked in'), 'A-5');
    await user.press(screen.getByRole('button', { name: /^Confirm\s/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(RESERVED_EN, visibleText);
    expect(screen.getByRole('header', { name: 'This is not my spot' })).toBeOnTheScreen();
    expect(parkingSession.spotAnswers).toEqual(['A-5']);
  });
});
