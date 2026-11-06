import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { visibleText } from './visibleText';
import { julieWith, PARKED_IN_A1 } from './walkAwayRig';
import { CONFIRM_TYPED, julieCorrecting, juliePresumedInA1, NOT_MY_SPOT, REFUSAL_MESSAGES, watchSpotFocus } from './whereParkedRig';

const SPOT_NUMBER = 'Numéro de la place où vous êtes garé';

describe('correcting the spot Palier presumed (story #22)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('offers « Ce n’est pas ma place » under « Garé en A-1 »', async () => {
    await juliePresumedInA1();

    expect(screen.getByRole('button', { name: NOT_MY_SPOT })).toBeOnTheScreen();
  });

  it('opens the number field alone, titled « Ce n’est pas ma place », with VoiceOver on the title', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();

    await julieCorrecting();

    const title = screen.getByRole('header', { name: NOT_MY_SPOT });
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ children: title.props.children }) }), 'focus');
    expect(screen.getByLabelText(SPOT_NUMBER)).toBeOnTheScreen();
    expect(screen.queryAllByRole('radio')).toEqual([]);
    expect(screen.queryByText(/Montant à ce jour/, visibleText)).toBeNull();
    expect(screen.queryByText(PARKED_IN_A1, visibleText)).toBeNull();
  });

  it('shows « Garé en A-3 » once Julie types A-3 and confirms, and moves VoiceOver to it without announcing it on top', async () => {
    const { user, parkingSession } = await julieCorrecting();
    const expectFocusedSpot = watchSpotFocus();

    await user.type(screen.getByLabelText(SPOT_NUMBER), 'A-3');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(parkingSession.spotAnswers).toEqual(['A-3']);
    expect(await screen.findByText('Garé en A-3', visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: NOT_MY_SPOT })).toBeNull();
    expectFocusedSpot('A-3');
  });

  it.each([
    ['UNKNOWN_SPOT', 'Z-99', REFUSAL_MESSAGES.UNKNOWN_SPOT],
    ['SPOT_TAKEN', 'B-4', REFUSAL_MESSAGES.SPOT_TAKEN],
  ])('shows the refusal %s of #21 under the field and keeps the form', async (code, typed, message) => {
    const { user, parkingSession } = await julieCorrecting();
    parkingSession.answerFailure = new PalierRejectedError(code);

    await user.type(screen.getByLabelText(SPOT_NUMBER), typed);
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message, visibleText);
    expect(screen.getByRole('header', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(screen.queryByText(PARKED_IN_A1, visibleText)).toBeNull();
    expect(parkingSession.spotAnswers).toEqual([typed]);
  });

  it('goes back to « Garé en A-1 » on « Annuler », sending nothing, with VoiceOver on the action again', async () => {
    const { user, parkingSession } = await julieCorrecting();
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();

    await user.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    const action = screen.getByRole('button', { name: NOT_MY_SPOT });
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ accessibilityLabel: action.props.accessibilityLabel }) }), 'focus');
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('leaves the session for the scan form when Palier answers SESSION_CLOSED, without an error', async () => {
    const { user, parkingSession } = await julieCorrecting();
    parkingSession.answerFailure = new PalierRejectedError('SESSION_CLOSED');
    parkingSession.session = null;

    await user.type(screen.getByLabelText(SPOT_NUMBER), 'A-3');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByRole('tab', { name: 'Scanner' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: NOT_MY_SPOT })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['confirmed by the loop only', 'ENTRY_CONFIRMED'],
    ['already confirmed parked', 'PARKED_CONFIRMED'],
  ] as const)('offers no correction for a session %s', async (_case, state) => {
    await julieWith(julieAtParkingDemo({ state }));

    expect(screen.queryByRole('button', { name: NOT_MY_SPOT })).toBeNull();
  });

  it('offers no correction beside the question « Où êtes-vous garé ? »', async () => {
    await julieWith(julieAtParkingDemo({ state: 'PARKED_UNCONFIRMED', question: { aisleCode: 'B', freeSpotNumbers: ['B-3'] } }));

    expect(await screen.findByRole('header', { name: 'Où êtes-vous garé ?' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: NOT_MY_SPOT })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
  });

  it('reads « This is not my spot » and « Cancel » on an English device', async () => {
    const { user } = await juliePresumedInA1('en');

    await user.press(screen.getByRole('button', { name: 'This is not my spot' }));

    expect(screen.getByRole('header', { name: 'This is not my spot' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Number of the spot you parked in')).toBeOnTheScreen();
  });
});
