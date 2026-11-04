import { Component, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { LotsClient } from '../src/api/LotsClient';
import { LotsClientProvider } from '../src/api/LotsClientContext';
import { applyLanguage } from '../src/i18n/i18n';
import { HomeScreen } from '../src/screens/HomeScreen';

class CaughtErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly caught?: Error }> {
  override state: { readonly caught?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { caught: error };
  }

  override render() {
    return this.state.caught === undefined ? this.props.children : <Text>{`caught: ${this.state.caught.message}`}</Text>;
  }
}

const brokenClient: LotsClient = { listLots: () => Promise.reject(new TypeError('a programming error')) };

describe('HomeScreen with an unexpected client failure', () => {
  it('lets the error surface instead of showing the unreachable state', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    applyLanguage('fr');

    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <CaughtErrorBoundary>
          <LotsClientProvider client={brokenClient}>
            <HomeScreen firstName="Julie" />
          </LotsClientProvider>
        </CaughtErrorBoundary>
      </SafeAreaProvider>,
    );

    expect(await screen.findByText('caught: a programming error')).toBeOnTheScreen();
    expect(screen.queryByText('Impossible de joindre Palier.')).not.toBeOnTheScreen();
  });
});
