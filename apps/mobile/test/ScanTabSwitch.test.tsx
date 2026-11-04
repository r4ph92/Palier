import { act, screen, userEvent } from '@testing-library/react-native';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { IPHONE_MINI_METRICS, renderPalierApp, signedInJulie } from './renderPalierApp';

jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

async function submitThenLeaveTheScannerTab() {
  const entryClient = new FakeEntryClient();
  entryClient.holdsAnswer = true;
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, metrics: IPHONE_MINI_METRICS, clients: () => ({ entry: entryClient }) });
  const user = userEvent.setup();
  await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
  await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: 'Scanner' }));
  await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
  await act(async () => entryClient.answer());
}

describe('leaving the Scanner tab while Palier checks the QR', () => {
  it('does not crash when the answer arrives on another tab', async () => {
    await submitThenLeaveTheScannerTab();

    expect(screen.getByRole('tab', { name: 'Stationnements', selected: true })).toBeOnTheScreen();
  });
});
