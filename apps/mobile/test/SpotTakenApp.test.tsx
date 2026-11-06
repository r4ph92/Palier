import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { julieAtParkingDemo, spotB3 } from './fakeParkingSessionClient';
import { CONFIRM_A1_TAKEN, julieReportingA1, julieThroughTheGate, NONE_FREE, REPORT_A1, SPOT_TAKEN } from './spotTakenRig';
import { asSeen, visibleText } from './visibleText';
import { julieWith, PARKED_IN_A1 } from './walkAwayRig';
import { CONFIRM_TYPED, WHERE_PARKED } from './whereParkedRig';

const NEW_SPOT_A2 = 'Nouvelle place : A-2';

function announcementsOf(message: string): unknown[][] {
  return jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.filter(([announced]) => asSeen(announced) === message);
}

describe('reporting the assigned spot taken (story #23)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('offers « Place prise » to Julie through the gate on A-1', async () => {
    await julieThroughTheGate();

    expect(screen.getByRole('button', { name: SPOT_TAKEN })).toBeOnTheScreen();
  });

  it('asks « Confirmer que la place A-1 est prise ? » before sending anything, with VoiceOver on the question', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();

    const { parkingSession } = await julieReportingA1();

    const question = screen.getByText(CONFIRM_A1_TAKEN, visibleText);
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ accessible: true }) }), 'focus');
    expect(question).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: REPORT_A1 })).toBeOnTheScreen();
    expect(parkingSession.spotTakenReports).toEqual([]);
  });

  it('shows « Nouvelle place : A-2 » once Julie confirms, and moves VoiceOver to the spot line without announcing it on top', async () => {
    const { user, parkingSession } = await julieReportingA1();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));

    expect(await screen.findByText(NEW_SPOT_A2, visibleText)).toBeOnTheScreen();
    expect(parkingSession.spotTakenReports).toEqual(['A-1']);
    const spotLine = screen.getByLabelText(`A-2 · Palier P1 · Allée A. ${NEW_SPOT_A2}`, visibleText);
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ accessibilityLabel: spotLine.props.accessibilityLabel }) }), 'focus');
    expect(announce.mock.calls.filter(([message]) => asSeen(message) === NEW_SPOT_A2)).toEqual([]);
    const action = screen.getByRole('button', { name: SPOT_TAKEN });
    expect(focus).not.toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ accessibilityLabel: action.props.accessibilityLabel }) }), 'focus');
    expect(screen.queryByText(CONFIRM_A1_TAKEN, visibleText)).toBeNull();
  });

  it('keeps « Nouvelle place : A-2 » on the spot line while Julie walks in aisle A, and guides her to A-2', async () => {
    const { user, enterAisle } = await julieReportingA1();
    await enterAisle(1);

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));

    expect(await screen.findByText(NEW_SPOT_A2, visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Vous êtes dans la bonne allée', visibleText)).toBeOnTheScreen();
  });

  it('gives Julie the aisle-B spot Palier chose when aisle A has no other fitting spot', async () => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.replacementSpot = spotB3;

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));

    expect(await screen.findByText('Nouvelle place : B-3', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Rendez-vous allée B, place B-3', visibleText)).toBeOnTheScreen();
  });

  it('opens « Où êtes-vous garé ? » with the notice that no other spot is free, announced after the title', async () => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.replacementSpot = null;
    const queued = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockClear();

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));

    expect(await screen.findByRole('header', { name: WHERE_PARKED })).toBeOnTheScreen();
    expect(screen.getByText(NONE_FREE, visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(/^Aucune place libre dans l’allée A/, visibleText)).toBeNull();
    expect(queued.mock.calls.filter(([message]) => asSeen(message) === NONE_FREE)).toEqual([[expect.any(String), { queue: true }]]);
  });

  it('places Julie where she says once no other spot was free, and drops the notice', async () => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.replacementSpot = null;
    await user.press(screen.getByRole('button', { name: REPORT_A1 }));
    await screen.findByText(NONE_FREE, visibleText);

    await user.type(screen.getByLabelText('Numéro de place'), 'A-5');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByText('Garé en A-5', visibleText)).toBeOnTheScreen();
    expect(parkingSession.spotAnswers).toEqual(['A-5']);
    expect(screen.queryByText(NONE_FREE, visibleText)).toBeNull();
  });

  it('asks the walk question without the notice when Palier asked it after a walk, not a report', async () => {
    const { parkingSession, enterAisle, walkAway } = await julieThroughTheGate();
    expect(parkingSession.spotTakenReports).toEqual([]);

    await enterAisle(2);
    await walkAway();

    expect(await screen.findByRole('header', { name: WHERE_PARKED })).toBeOnTheScreen();
    expect(screen.queryByText(NONE_FREE, visibleText)).toBeNull();
  });

  it.each(['PARKED_PRESUMED', 'PARKED_CONFIRMED'] as const)('does not offer « Place prise » to a session %s', async (state) => {
    await julieWith(julieAtParkingDemo({ state }));
    await screen.findByText(PARKED_IN_A1, visibleText);

    expect(screen.queryByRole('button', { name: SPOT_TAKEN })).toBeNull();
  });

  it('does not offer « Place prise » before the loop confirmed the entry', async () => {
    await julieWith(julieAtParkingDemo({ state: 'CREATED' }));
    await screen.findByText('Entrée en attente de confirmation', visibleText);

    expect(screen.queryByRole('button', { name: SPOT_TAKEN })).toBeNull();
  });

  it('reads « Spot taken » and « New spot: A-2 » on an English device', async () => {
    const { user } = await julieThroughTheGate('en');

    await user.press(screen.getByRole('button', { name: 'Spot taken' }));
    expect(screen.getByText('Confirm that spot A-1 is taken?', visibleText)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: /^Report A-\u2060?1 taken$/ }));

    expect(await screen.findByText('New spot: A-2', visibleText)).toBeOnTheScreen();
  });

  it('drops « Nouvelle place » once Julie walks away from A-2, without announcing it again', async () => {
    const { user, walkAway } = await julieReportingA1();
    await user.press(screen.getByRole('button', { name: REPORT_A1 }));
    await screen.findByText(NEW_SPOT_A2, visibleText);
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();

    await walkAway();

    expect(await screen.findByText('Garé en A-2', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(NEW_SPOT_A2, visibleText)).toBeNull();
    expect(announcementsOf(NEW_SPOT_A2)).toEqual([]);
  });
});
