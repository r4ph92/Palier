import type { SignInResponse } from '@palier/shared-types';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PalierStatusError } from '../src/api/LotsClient';
import { applyLanguage } from '../src/i18n/i18n';
import { TestSignInSection } from '../src/testSignIn/TestSignInSection';
import { FakeAuthClient, FakeTestSignInClient } from './fakeAuth';

const NOT_FOUND = 404;

class ReseededTestSignInClient extends FakeTestSignInClient {
  override signInAsTestDriver(): Promise<SignInResponse> {
    return Promise.reject(new PalierStatusError(NOT_FOUND));
  }
}

describe('TestSignInSection after a reseed', () => {
  it('says the driver no longer exists when the sign-in route answers 404, without signing in', async () => {
    applyLanguage('fr');
    const client = new ReseededTestSignInClient(new FakeAuthClient());
    const onSignedIn = jest.fn(() => Promise.resolve());
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } }}>
        <TestSignInSection client={client} onSignedIn={onSignedIn} />
      </SafeAreaProvider>,
    );
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Julie Tremblay' }));

    expect(await screen.findByText('Ce conducteur n’existe plus.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Marc Gagnon' })).toBeOnTheScreen();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
