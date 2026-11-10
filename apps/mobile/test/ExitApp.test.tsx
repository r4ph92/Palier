import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { julieAtB3, julieAtParkingDemo } from './fakeParkingSessionClient';
import { FakeReceiptClient, julieReceipt } from './fakeReceiptClient';
import { asSeen, visibleText } from './visibleText';
import { PENDING_RECEIPT_POLL_MILLISECONDS } from '../src/receipts/usePendingReceipt';
import { advance, julieWith } from './walkAwayRig';

const EXIT = 'Ouvrir la barrière de sortie';
const FRENCH_RECEIPT = 'Durée 3 h 15 · 13 × 0,75 $ · Total 9,75 $';
const ENGLISH_RECEIPT = 'Duration 3 h 15 · 13 × $0.75 · Total $9.75';

async function julieAtTheExit(language: 'fr' | 'en' = 'fr', session = julieAtParkingDemo(), receipts?: FakeReceiptClient) {
  const rig = await julieWith(session, language, receipts);
  return { ...rig, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }) };
}

describe('leaving with the « Ouvrir » tap (story #47)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 21, 17) }));
  afterEach(() => jest.useRealTimers());

  it('shows the 3 h 15 receipt after Julie taps « Ouvrir la barrière de sortie »', async () => {
    const { user, parkingSession } = await julieAtTheExit();

    await user.press(screen.getByRole('button', { name: EXIT }));

    expect(await screen.findByText(FRENCH_RECEIPT, visibleText)).toBeOnTheScreen();
    expect(parkingSession.exits).toEqual(['session-1']);
    expect(screen.getByRole('header', { name: 'Barrière de sortie ouverte' })).toBeOnTheScreen();
  });

  it('reads the receipt in English on an English device', async () => {
    const { user } = await julieAtTheExit('en');

    await user.press(screen.getByRole('button', { name: 'Open the exit barrier' }));

    expect(await screen.findByText(ENGLISH_RECEIPT, visibleText)).toBeOnTheScreen();
  });

  it('offers the exit to a driver parked in B-3 too', async () => {
    await julieAtTheExit('fr', julieAtB3({ state: 'PARKED_CONFIRMED' }));

    expect(screen.getByRole('button', { name: EXIT })).toBeOnTheScreen();
  });

  it('offers no exit before the entry loop confirmed the session', async () => {
    await julieWith(julieAtParkingDemo({ state: 'CREATED' }));

    expect(screen.queryByRole('button', { name: EXIT })).toBeNull();
  });

  it('sends one request while the first is still waiting', async () => {
    const { user, parkingSession } = await julieAtTheExit();
    parkingSession.holdsExit = true;

    await user.press(screen.getByRole('button', { name: EXIT }));
    expect(screen.getByRole('button', { name: 'Ouverture…' })).toBeDisabled();
    await user.press(screen.getByRole('button', { name: 'Ouverture…' }));

    expect(parkingSession.exits).toHaveLength(1);
  });

  it('closes the receipt with « Terminé » and gives the scanner back, the session being closed', async () => {
    const { user } = await julieAtTheExit();
    await user.press(screen.getByRole('button', { name: EXIT }));

    await user.press(await screen.findByRole('button', { name: 'Terminé' }));

    expect(screen.queryByText(FRENCH_RECEIPT, visibleText)).toBeNull();
    expect(screen.getByLabelText('Contenu du QR')).toBeOnTheScreen();
  });

  it('says Palier cannot be reached, announces it and lets Julie tap again', async () => {
    const { user, parkingSession } = await julieAtTheExit();
    parkingSession.exitFailure = new PalierUnreachableError('fake');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();

    await user.press(screen.getByRole('button', { name: EXIT }));

    const message = 'Impossible de joindre Palier. Vérifiez votre connexion, puis réessayez.';
    expect(await screen.findByText(message, visibleText)).toBeOnTheScreen();
    expect(announce.mock.calls.filter(([announced]) => asSeen(announced) === message)).toHaveLength(1);
    parkingSession.exitFailure = null;
    await user.press(screen.getByRole('button', { name: EXIT }));
    expect(await screen.findByText(FRENCH_RECEIPT, visibleText)).toBeOnTheScreen();
  });

  it('reads the session again when Palier refuses the tap, the session being closed', async () => {
    const { user, parkingSession } = await julieAtTheExit();
    parkingSession.exitFailure = new PalierRejectedError('SESSION_CLOSED');
    parkingSession.session = null;

    await user.press(screen.getByRole('button', { name: EXIT }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText(FRENCH_RECEIPT, visibleText)).toBeNull();
  });

  describe('when Stripe is unreachable (story #50)', () => {
    const PENDING_FR = 'Barrière ouverte — votre reçu suivra';
    const PENDING_EN = 'Barrier open — your receipt will follow';

    async function leaveWithCapturePending(language: 'fr' | 'en' = 'fr') {
      const receipts = new FakeReceiptClient();
      const rig = await julieAtTheExit(language, julieAtParkingDemo(), receipts);
      rig.parkingSession.exitsWithCapturePending = true;
      await rig.user.press(screen.getByRole('button', { name: language === 'fr' ? EXIT : 'Open the exit barrier' }));
      return { ...rig, receipts };
    }

    it('says the barrier is open and the receipt will follow', async () => {
      await leaveWithCapturePending();

      expect(await screen.findByRole('header', { name: PENDING_FR })).toBeOnTheScreen();
      expect(screen.queryByText(FRENCH_RECEIPT, visibleText)).toBeNull();
    });

    it('says it in English on an English device', async () => {
      await leaveWithCapturePending('en');

      expect(await screen.findByRole('header', { name: PENDING_EN })).toBeOnTheScreen();
    });

    it('shows the receipt once the capture is taken, asking again until then', async () => {
      const { receipts } = await leaveWithCapturePending();
      await screen.findByRole('header', { name: PENDING_FR });
      await advance(PENDING_RECEIPT_POLL_MILLISECONDS);
      expect(screen.getByRole('header', { name: PENDING_FR })).toBeOnTheScreen();

      receipts.add(julieReceipt({ sessionId: 'session-1' }));
      await advance(PENDING_RECEIPT_POLL_MILLISECONDS);

      expect(await screen.findByText(FRENCH_RECEIPT, visibleText)).toBeOnTheScreen();
    });

    it('gives the scanner back with « Terminé » while the capture is still pending', async () => {
      const { user } = await leaveWithCapturePending();

      await user.press(await screen.findByRole('button', { name: 'Terminé' }));

      expect(screen.getByLabelText('Contenu du QR')).toBeOnTheScreen();
    });
  });
});
