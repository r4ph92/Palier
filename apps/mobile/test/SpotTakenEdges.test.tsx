import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { CONFIRM_A1_TAKEN, julieReportingA1, KEEP_A1, REPORT_A1, SPOT_TAKEN } from './spotTakenRig';
import { visibleText } from './visibleText';
import { PARKED_IN_A1 } from './walkAwayRig';

const UNREACHABLE = 'Impossible de joindre Palier. Vérifiez votre connexion, puis réessayez.';

describe('reporting the assigned spot taken, the edges (story #23)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('goes back to « Place prise » on « Garder A-1 », sending nothing, with VoiceOver on the action again', async () => {
    const { user, parkingSession } = await julieReportingA1();
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();

    await user.press(screen.getByRole('button', { name: KEEP_A1 }));

    const action = screen.getByRole('button', { name: SPOT_TAKEN });
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ accessibilityLabel: action.props.accessibilityLabel }) }), 'focus');
    expect(parkingSession.spotTakenReports).toEqual([]);
  });

  it('shows « Envoi… » without « Garder A-1 » while the report is in flight, and sends one report for two taps', async () => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.holdsSpotTakenReport = true;

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));
    await user.press(screen.getByRole('button', { name: 'Envoi…' }));

    expect(screen.queryByRole('button', { name: KEEP_A1 })).toBeNull();
    expect(parkingSession.spotTakenReports).toEqual(['A-1']);
  });

  it.each([
    ['without network', new PalierUnreachableError('offline')],
    ['while the lot is busy', new PalierStatusError(503)],
  ])('says Palier cannot be reached %s, keeps the question, and announces it', async (_case, failure) => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.spotTakenFailure = failure;
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));

    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE);
    expect(announce).toHaveBeenCalledWith(UNREACHABLE);
    expect(screen.getByText(CONFIRM_A1_TAKEN, visibleText)).toBeOnTheScreen();
  });

  it('reads the session again, without an error, when Palier says Julie already parked', async () => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.spotTakenFailure = new PalierRejectedError('ALREADY_PARKED');
    parkingSession.session = parkingSession.session === null ? null : { ...parkingSession.session, state: 'PARKED_PRESUMED' };

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));

    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: SPOT_TAKEN })).toBeNull();
  });

  it('leaves the session for the scan form when Palier answers SESSION_CLOSED, without an error', async () => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.spotTakenFailure = new PalierRejectedError('SESSION_CLOSED');
    parkingSession.session = null;

    await user.press(screen.getByRole('button', { name: REPORT_A1 }));

    expect(await screen.findByRole('tab', { name: 'Scanner', selected: true })).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops the message of a failed report once Julie keeps A-1, so asking again starts clean', async () => {
    const { user, parkingSession } = await julieReportingA1();
    parkingSession.spotTakenFailure = new PalierUnreachableError('offline');
    await user.press(screen.getByRole('button', { name: REPORT_A1 }));
    await screen.findByRole('alert');

    await user.press(screen.getByRole('button', { name: KEEP_A1 }));
    await user.press(screen.getByRole('button', { name: SPOT_TAKEN }));

    expect(screen.getByText(CONFIRM_A1_TAKEN, visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
