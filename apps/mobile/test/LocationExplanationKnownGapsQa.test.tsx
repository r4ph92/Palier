import { act, fireEvent, screen, userEvent } from '@testing-library/react-native';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { PendingPromptLocationClient, TITLE_FR } from './locationExplanationHarness';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

// Gaps QA found on story #16, kept as regression tests.

async function openScanner(location: FakeBackgroundLocationClient, store: MemoryLocationExplanationStore) {
  await renderPalierApp({ ...signedInJulie(), clients: () => ({ backgroundLocation: location, locationExplanation: store }) });
  const user = userEvent.setup();
  await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
  return user;
}

afterEach(() => jest.restoreAllMocks());

describe('regressions in the « Always » explanation', () => {
  it('keeps the explanation away for the rest of the app session when the flag cannot be saved', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const location = new FakeBackgroundLocationClient();
    const store = new MemoryLocationExplanationStore(false);
    store.markAnswered = () => Promise.reject(new Error('keychain full'));
    const user = await openScanner(location, store);
    await user.press(await screen.findByRole('button', { name: 'Continuer' }));
    await screen.findByLabelText('Contenu du QR');

    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    await screen.findByLabelText('Contenu du QR');

    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
  });

  it('asks iOS once when two taps land in the same frame', async () => {
    const location = new PendingPromptLocationClient();
    await openScanner(location, new MemoryLocationExplanationStore(false));
    const continueButton = await screen.findByRole('button', { name: 'Continuer' });

    act(() => {
      fireEvent.press(continueButton);
      fireEvent.press(continueButton);
    });
    await act(async () => location.answerPrompt(false));

    expect(location.alwaysRequests).toBe(1);
  });
});
