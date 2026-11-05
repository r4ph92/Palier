import { act, fireEvent, renderHook, screen, userEvent, waitFor } from '@testing-library/react-native';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemo, parkingDemoWith, parkingTestPaliers } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { heldSpotFrom } from '../src/spotHolds/heldSpot';
import { useHoldCountdown } from '../src/spotHolds/useHoldCountdown';
import { visibleText } from './visibleText';

jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

const DEMO_BUTTON = 'Garantir une place 15 min à Parking Démo';
const PALIERS_BUTTON = 'Garantir une place 15 min à Parking Test Paliers';

async function renderLots(spotHoldClient: FakeSpotHoldClient, lotsClient = new FakeLotsClient(parkingDemoWith(10))) {
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient });
}

describe('QA spot hold on the lot list', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 2));
  });
  afterEach(() => jest.useRealTimers());

  it('sends one request when both lots are tapped in the same tick', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.holdsAnswer = true;
    const lotsClient = new FakeLotsClient([parkingDemo(10), parkingTestPaliers]);
    await renderLots(spotHoldClient, lotsClient);
    const demo = await screen.findByRole('button', { name: DEMO_BUTTON });
    const paliers = screen.getByRole('button', { name: PALIERS_BUTTON });

    await act(async () => {
      fireEvent.press(demo);
      fireEvent.press(paliers);
      fireEvent.press(demo);
    });

    expect(spotHoldClient.heldLots).toEqual([expect.any(String)]);
    await act(async () => spotHoldClient.answer());
    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    await waitFor(() => expect(lotsClient.callCount).toBe(2));
  });

  it('clears a refusal when the next tap succeeds', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'HOLD_QUOTA_REACHED';
    await renderLots(spotHoldClient);
    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: DEMO_BUTTON }));
    expect(await screen.findByText('Trop de places garanties dans ce parking pour le moment')).toBeOnTheScreen();

    spotHoldClient.nextRejection = null;
    await user.press(screen.getByRole('button', { name: DEMO_BUTTON }));

    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(screen.queryByText('Trop de places garanties dans ce parking pour le moment')).not.toBeOnTheScreen();
  });

  it('draws a hostile lot name as plain text', async () => {
    const hostileName = '<script>alert(1)</script> 🚗 Ünïcode "quoted" \' ; drop table spot_hold; --';
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.activeHold = julieHoldAtParkingDemo({ lotName: hostileName });
    await renderLots(spotHoldClient);

    expect(await screen.findByText(hostileName)).toBeOnTheScreen();
    expect(screen.getByTestId('spot-hold-banner')).toHaveProp('accessibilityLabel', expect.stringContaining(hostileName));
  });

  it('keeps a 300-character lot name inside the banner without losing the countdown', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo({ lotName: 'Stationnement '.repeat(25).trim() }));
    await renderLots(spotHoldClient);

    expect(await screen.findByTestId('spot-hold-countdown')).toHaveTextContent('15:00');
    expect(screen.getByText('Place garantie jusqu’à 14 h 17', visibleText)).toBeOnTheScreen();
  });

  it('counts the 15 minutes from the server clock when the phone is hours off', async () => {
    const serverNow = new Date(2026, 10, 4, 14, 2);
    jest.setSystemTime(new Date(2026, 10, 4, 19, 40));
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo({ now: serverNow.toISOString() }));
    await renderLots(spotHoldClient);

    expect(await screen.findByTestId('spot-hold-countdown')).toHaveTextContent('15:00');
    expect(screen.getByText('Place garantie jusqu’à 14 h 17', visibleText)).toBeOnTheScreen();
  });

  it('shows the expiry message for a hold read back past its end', async () => {
    const lateRead = julieHoldAtParkingDemo({ now: new Date(2026, 10, 4, 14, 40).toISOString() });
    await renderLots(new FakeSpotHoldClient(lateRead));

    expect(await screen.findByTestId('spot-hold-expired')).toHaveTextContent('Votre place garantie a expiré');
    expect(screen.queryByTestId('spot-hold-countdown')).not.toBeOnTheScreen();
  });
});

describe('QA spot hold countdown timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 2));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('starts one one-second timer while time is left and clears it on unmount', async () => {
    const held = heldSpotFrom(julieHoldAtParkingDemo(), Date.now(), false);
    const started = jest.spyOn(globalThis, 'setInterval');
    const cleared = jest.spyOn(globalThis, 'clearInterval');
    const { unmount } = await renderHook(() => useHoldCountdown(held));
    expect(started).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(cleared).not.toHaveBeenCalled();

    await unmount();

    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('starts no timer for a hold already past its end', async () => {
    const held = heldSpotFrom(julieHoldAtParkingDemo({ now: new Date(2026, 10, 4, 14, 40).toISOString() }), Date.now(), false);
    const started = jest.spyOn(globalThis, 'setInterval');

    const { result } = await renderHook(() => useHoldCountdown(held));

    expect(result.current?.countdown).toEqual({ kind: 'expired' });
    expect(started).not.toHaveBeenCalled();
  });

  it('clears its timer when the countdown reaches 0', async () => {
    const held = heldSpotFrom(julieHoldAtParkingDemo(), Date.now(), false);
    const cleared = jest.spyOn(globalThis, 'clearInterval');
    const { result } = await renderHook(() => useHoldCountdown(held));

    await act(() => jest.advanceTimersByTimeAsync(15 * 60 * 1000));

    expect(result.current?.countdown).toEqual({ kind: 'expired' });
    expect(cleared).toHaveBeenCalled();
  });
});

describe('QA spot hold across sign-out', () => {
  it('shows no hold to the next driver who signs in after Julie signed out', async () => {
    const { authClient, tokenStore } = signedInJulie();
    const julieHold = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const nextDriverHold = new FakeSpotHoldClient();
    let hasSignedOut = false;
    await renderPalierApp({
      authClient,
      tokenStore,
      testSignInEnabled: true,
      clients: () => ({ spotHold: hasSignedOut ? nextDriverHold : julieHold }),
    });
    const user = userEvent.setup();
    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    hasSignedOut = true;
    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));
    await user.press(await screen.findByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Marc Gagnon' }));

    expect(await screen.findByRole('button', { name: DEMO_BUTTON })).toBeOnTheScreen();
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });
});
