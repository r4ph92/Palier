import { screen, userEvent, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { AISLE_B_FREE_SPOTS, FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { asSeen, visibleText } from './visibleText';
import { GO_TO_A1, PARKED_IN_A1 } from './walkAwayRig';
import { CONFIRM_TYPED, expectFocusedSpotWithoutAnnouncement, julieAskedInAisleB, REFUSAL_MESSAGES, WHERE_PARKED } from './whereParkedRig';

const WALKING = 'Stationné (à pied, confiance élevée)';

describe('asking where Julie parked after a walk in another aisle (story #21)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('asks « Où êtes-vous garé ? » with the free spots of aisle B after « Allée 2 » then « Stationné » in the panel', async () => {
    const toolkit = createSimulatedToolkit(() => Date.now());
    const positioning = new PositioningCore(toolkit.module);
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, developerEntry: toolkit.bind(positioning), positioning, clients: () => ({ parkingSession }) });
    await screen.findByText(GO_TO_A1, visibleText);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Développeur' }));
    await user.press(await screen.findByRole('button', { name: 'Allée 2' }));

    await user.press(await screen.findByRole('button', { name: WALKING }));
    await user.press(screen.getByRole('tab', { name: 'Session' }));

    expect(parkingSession.parkedReports).toEqual([expect.objectContaining({ aisleMinor: 2 })]);
    expect(await screen.findByRole('header', { name: WHERE_PARKED })).toBeOnTheScreen();
    const offered = screen.getAllByRole('radio', { name: /^B-\d$/ }).map((row) => row.props.accessibilityLabel as string);
    expect(offered).toEqual(AISLE_B_FREE_SPOTS);
    expect(screen.getByLabelText('Numéro de place')).toBeOnTheScreen();
  });

  it('shows only the question: no A-1, no guidance, no amount, no « Garé en »', async () => {
    await julieAskedInAisleB();

    expect(screen.queryByText(/A-1/, visibleText)).toBeNull();
    expect(screen.queryByText(GO_TO_A1, visibleText)).toBeNull();
    expect(screen.queryByText(/Montant à ce jour/, visibleText)).toBeNull();
    expect(screen.queryByText(/Garé en/, visibleText)).toBeNull();
    expect(screen.getByRole('header', { name: 'Parking Démo' })).toBeOnTheScreen();
  });

  it('moves VoiceOver to the question when it appears', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();

    await julieAskedInAisleB();

    const question = screen.getByRole('header', { name: WHERE_PARKED });
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ children: question.props.children }) }), 'focus');
  });

  it('writes B-3 in the field on a tap, and sends nothing before « Confirmer »', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();

    await user.press(screen.getByRole('radio', { name: 'B-3' }));

    expect(screen.getByLabelText('Numéro de place')).toHaveDisplayValue('B-3');
    expect(screen.getByRole('radio', { name: 'B-3' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'B-1' })).not.toBeChecked();
    expect(asSeen(screen.getByRole('button', { name: CONFIRM_TYPED }).props.accessibilityLabel as string)).toBe('Confirmer B-3');
    expect(screen.getByLabelText('Places libres dans l’allée B')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('checks the row whose number Julie typed, whatever its shape', async () => {
    const { user } = await julieAskedInAisleB();

    await user.type(screen.getByLabelText('Numéro de place'), 'b3');

    expect(screen.getByRole('radio', { name: 'B-3' })).toBeChecked();
  });

  it('shows « Garé en B-3 » once Julie chooses B-3 and confirms, and moves VoiceOver to it without announcing it on top', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();

    await user.press(screen.getByRole('radio', { name: 'B-3' }));
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(parkingSession.spotAnswers).toEqual(['B-3']);
    expect(await screen.findByText('Garé en B-3', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(WHERE_PARKED, visibleText)).toBeNull();
    expectFocusedSpotWithoutAnnouncement('B-3');
  });

  it('sends a number typed in the field as typed, and shows the spot Palier placed the car in', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();

    await user.type(screen.getByLabelText('Numéro de place'), 'A-1');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(parkingSession.spotAnswers).toEqual(['A-1']);
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
  });

  it.each([
    ['UNKNOWN_SPOT', 'Z-99', REFUSAL_MESSAGES.UNKNOWN_SPOT],
    ['SPOT_TAKEN', 'B-4', REFUSAL_MESSAGES.SPOT_TAKEN],
    ['SPOT_OUT_OF_SERVICE', 'B-5', REFUSAL_MESSAGES.SPOT_OUT_OF_SERVICE],
  ])('shows the refusal %s under the field and keeps the question', async (code, typed, message) => {
    const { user, parkingSession } = await julieAskedInAisleB();
    parkingSession.answerFailure = new PalierRejectedError(code);

    await user.type(screen.getByLabelText('Numéro de place'), typed);
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message, visibleText);
    expect(asSeen(screen.getByLabelText('Numéro de place').props.accessibilityHint as string)).toBe(message);
    expect(screen.getByRole('header', { name: WHERE_PARKED })).toBeOnTheScreen();
  });

  it('sizes the field for a number, not the full width', async () => {
    await julieAskedInAisleB();

    expect(screen.getByLabelText('Numéro de place')).toHaveStyle({ alignSelf: 'flex-start', minWidth: 160 });
  });

  it.each([
    ['choosing another row', async (user: ReturnType<typeof userEvent.setup>) => user.press(screen.getByRole('radio', { name: 'B-1' }))],
    ['typing in the field', async (user: ReturnType<typeof userEvent.setup>) => user.type(screen.getByLabelText('Numéro de place'), '1')],
  ])('clears the refusal, under the field and in its hint, on %s', async (_case, change) => {
    const { user, parkingSession } = await julieAskedInAisleB();
    parkingSession.answerFailure = new PalierRejectedError('SPOT_TAKEN');
    await user.press(screen.getByRole('radio', { name: 'B-3' }));
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));
    await screen.findByRole('alert');

    await change(user);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Numéro de place')).not.toHaveProp('accessibilityHint', expect.anything());
  });

  it('gives the field no hint before a refusal', async () => {
    await julieAskedInAisleB();

    expect(screen.getByLabelText('Numéro de place')).not.toHaveProp('accessibilityHint', expect.anything());
  });

  it('reads « Where are you parked? » and its refusals on an English device', async () => {
    const { user, parkingSession } = await julieAskedInAisleB('en');
    parkingSession.answerFailure = new PalierRejectedError('SPOT_TAKEN');

    await user.press(screen.getByRole('radio', { name: 'B-3' }));
    await user.press(screen.getByRole('button', { name: /^Confirm\s/ }));

    expect(screen.getByRole('header', { name: 'Where are you parked?' })).toBeOnTheScreen();
    expect(screen.getByText('Free spots in aisle B')).toBeOnTheScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('This spot is already assigned — check the number on the ground', visibleText);
    expect(within(screen.getByRole('button', { name: /^Confirm\s/ })).getByText('Confirm B-3', visibleText)).toBeOnTheScreen();
  });
});
