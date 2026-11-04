import { getDefaultNormalizer, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { applyLanguage, i18n } from '../src/i18n/i18n';
import { spotLabel } from '../src/components/SpotLine';
import { ENTREE_DEMO_QR, FakeEntryClient, spotA1 } from './fakeEntryClient';
import { openScanner, scan } from './renderScanScreen';

// The spot number carries an invisible word joiner after its hyphen; the driver reads the same text without it.
const visibleText = { normalizer: (text: string) => getDefaultNormalizer()(text.replaceAll('\u2060', '')) };

describe('ScanScreen, entering Parking Démo', () => {
  it('shows Julie her spot and the open barrier in French', async () => {
    const { client } = await scan();

    expect(await screen.findByText('Votre place : A-1 · Palier P1 · Allée A', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
    expect(client.scanned).toEqual([ENTREE_DEMO_QR]);
  });

  it('shows the spot and the open barrier in English', async () => {
    await scan({ language: 'en' });

    expect(await screen.findByText('Your spot: A-1 · Level P1 · Aisle A', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Barrier open')).toBeOnTheScreen();
  });

  it.each([
    ['fr', 'Votre place\u00A0: A-1\u00A0· Palier\u00A0P1\u00A0· Allée\u00A0A'],
    ['en', 'Your spot: A-1\u00A0· Level\u00A0P1\u00A0· Aisle\u00A0A'],
  ] as const)('in %s, breaks the spot line only after a « · », never inside « Palier P1 » or before a « · »', (language, label) => {
    applyLanguage(language);

    expect(spotLabel(spotA1, i18n.t('scan.spotLead'))).toBe(label);
  });

  it('shows the spot number as the largest text, in mono with tabular figures, unbreakable at its hyphen', async () => {
    await scan();

    const number = await screen.findByText('A-\u20601');

    expect(number).toHaveStyle({ fontFamily: 'IBMPlexMono_600SemiBold', fontVariant: ['tabular-nums'] });
    expect(number.props.style.fontSize).toBeGreaterThan(32);
  });

  it('moves VoiceOver to the spot and the open barrier as soon as they show', async () => {
    const sendAccessibilityEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await scan();

    const result = await screen.findByLabelText('Votre place\u00A0: A-1\u00A0· Palier\u00A0P1\u00A0· Allée\u00A0A. Barrière ouverte');

    expect(sendAccessibilityEvent).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(result).toBeOnTheScreen();
  });


  it('goes back to an empty form with "Terminé"', async () => {
    const { user } = await scan();

    await user.press(await screen.findByRole('button', { name: 'Terminé' }));

    expect(screen.getByLabelText('Contenu du QR')).toHaveDisplayValue('');
    expect(screen.queryByText('Barrière ouverte')).not.toBeOnTheScreen();
  });

  it('shows the button busy while Palier checks the QR', async () => {
    const client = new FakeEntryClient();
    client.holdsAnswer = true;
    await scan({ client });

    expect(screen.getByRole('button', { name: 'Vérification…' })).toBeDisabled();

    client.answer();
    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
  });
});

describe('ScanScreen before a QR is pasted', () => {
  it('does not repeat the visible hint as a VoiceOver hint on the QR field', async () => {
    await openScanner();

    expect(screen.getByLabelText('Contenu du QR')).not.toHaveProp('accessibilityHint');
    expect(screen.getByText('Collez le contenu du QR de la borne d’entrée.')).toBeOnTheScreen();
  });

  it('keeps Scanner disabled while the field is empty or blank, and sends nothing', async () => {
    const client = await openScanner();
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Scanner' })).toBeDisabled();
    await user.type(screen.getByLabelText('Contenu du QR'), '   ');
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    expect(screen.getByRole('button', { name: 'Scanner' })).toBeDisabled();
    expect(client.scanned).toEqual([]);

    await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
    expect(screen.getByRole('button', { name: 'Scanner' })).toBeEnabled();
  });
});
