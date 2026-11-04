import type { ReactNode } from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { ScanScreen } from '../src/screens/ScanScreen';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { IPHONE_MINI_METRICS } from './renderPalierApp';

interface Scan {
  readonly client?: FakeEntryClient;
  readonly language?: SupportedLanguage;
  readonly onAddPlate?: () => void;
  readonly onAddCard?: () => void;
  readonly wrap?: (screen: ReactNode) => ReactNode;
}

export async function openScanner({ client = new FakeEntryClient(), language = 'fr', onAddPlate = jest.fn(), onAddCard = jest.fn(), wrap = (screen) => screen }: Scan = {}) {
  applyLanguage(language);
  await render(
    <SafeAreaProvider initialMetrics={IPHONE_MINI_METRICS}>
      {wrap(<ScanScreen client={client} onAddPlate={onAddPlate} onAddCard={onAddCard} />)}
    </SafeAreaProvider>,
  );
  return client;
}

// Opens the Scanner, pastes the QR of Entrée Démo and presses Scanner.
export async function scan(options: Scan = {}) {
  const client = await openScanner(options);
  const user = userEvent.setup();
  const labels = options.language === 'en' ? { field: 'QR content', submit: 'Scan' } : { field: 'Contenu du QR', submit: 'Scanner' };
  await user.type(screen.getByLabelText(labels.field), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: labels.submit }));
  return { client, user };
}
