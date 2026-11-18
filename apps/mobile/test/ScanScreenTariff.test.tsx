import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ENTREE_DEMO_QR, FakeEntryClient, PARKING_DEMO_TARIFF, SOPHIE_NEW_TARIFF } from './fakeEntryClient';
import { openScanner } from './renderScanScreen';
import { visibleText } from './visibleText';

async function scanEntreeDemo(client: FakeEntryClient, language: 'fr' | 'en' = 'fr') {
  await openScanner({ client, language });
  const user = userEvent.setup();
  const labels = language === 'en' ? { field: 'QR content', submit: 'Scan' } : { field: 'Contenu du QR', submit: 'Scanner' };
  await user.type(screen.getByLabelText(labels.field), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: labels.submit }));
  return user;
}

// #151: after the scan, Julie sees the lot's tariff and the hold, and only « Entrer » asks for the barrier.
describe('ScanScreen, the tariff before the barrier opens', () => {
  it('shows Parking Démo at 0,75 $ par 15 min, plafond 25,00 $, and the 25,00 $ hold, without entering', async () => {
    const client = new FakeEntryClient();
    await scanEntreeDemo(client);

    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    expect(screen.getByText('0,75 $ par 15 min, plafond 25,00 $ par jour', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('25,00 $ seront retenus sur votre carte jusqu’à votre sortie', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Entrer' })).toBeEnabled();
    expect(client.enteredAt).toEqual([]);
    expect(screen.queryByText('Barrière ouverte')).not.toBeOnTheScreen();
  });

  it('enters at the tariff on screen once Julie taps « Entrer »', async () => {
    const client = new FakeEntryClient();
    const user = await scanEntreeDemo(client);

    await user.press(await screen.findByRole('button', { name: 'Entrer' }));

    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
    expect(client.enteredAt).toEqual([PARKING_DEMO_TARIFF]);
  });

  it('goes back to an empty form on « Annuler », without entering', async () => {
    const client = new FakeEntryClient();
    const user = await scanEntreeDemo(client);

    await user.press(await screen.findByRole('button', { name: 'Annuler' }));

    expect(screen.getByLabelText('Contenu du QR')).toHaveDisplayValue('');
    expect(screen.queryByText('Parking Démo')).not.toBeOnTheScreen();
    expect(client.enteredAt).toEqual([]);
  });

  it('shows the new tariff and its 30,00 $ hold when Sophie changed it, and enters only on a second « Entrer »', async () => {
    const client = new FakeEntryClient();
    const user = await scanEntreeDemo(client);
    await screen.findByRole('button', { name: 'Entrer' });
    client.lotTariff = SOPHIE_NEW_TARIFF;

    await user.press(screen.getByRole('button', { name: 'Entrer' }));

    expect(await screen.findByText('Le tarif de ce parking vient de changer')).toBeOnTheScreen();
    expect(screen.getByText('1,00 $ par 15 min, plafond 30,00 $ par jour', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('30,00 $ seront retenus sur votre carte jusqu’à votre sortie', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Barrière ouverte')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Entrer' }));

    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
    expect(client.enteredAt).toEqual([PARKING_DEMO_TARIFF, SOPHIE_NEW_TARIFF]);
  });

  it('queues the change and the new tariff for VoiceOver behind « Entrer » coming back', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => undefined);
    const client = new FakeEntryClient();
    const user = await scanEntreeDemo(client);
    client.lotTariff = SOPHIE_NEW_TARIFF;

    await user.press(await screen.findByRole('button', { name: 'Entrer' }));
    await screen.findByText('Le tarif de ce parking vient de changer');

    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Le tarif de ce parking vient de changer\. 1,00\s\$ par 15\smin, plafond 30,00\s\$ par jour$/), { queue: true });
    announce.mockRestore();
  });

  it('shows the tariff and the hold in English, with no French left', async () => {
    const user = await scanEntreeDemo(new FakeEntryClient(), 'en');

    expect(await screen.findByText('$0.75 per 15 min, daily cap $25.00', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('$25.00 will be held on your card until you exit', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enter' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    expect(screen.queryByText(/par|plafond|retenus|Entrer|Annuler/)).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Enter' }));
    expect(await screen.findByText('Barrier open')).toBeOnTheScreen();
  });
});
