import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';

function Exploding(): never {
  throw new TypeError('a programming error');
}

async function renderCrashingApp(language: SupportedLanguage) {
  applyLanguage(language);
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AppErrorBoundary>
        <Exploding />
      </AppErrorBoundary>
    </SafeAreaProvider>,
  );
}

describe('AppErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it('logs the error and shows a generic message in French', async () => {
    await renderCrashingApp('fr');

    expect(screen.getByText('Une erreur inattendue est survenue.')).toBeOnTheScreen();
    expect(consoleError).toHaveBeenCalledWith('Palier crashed', expect.any(TypeError), expect.any(String));
  });

  it('shows the generic message in English', async () => {
    await renderCrashingApp('en');

    expect(screen.getByText('Something unexpected went wrong.')).toBeOnTheScreen();
  });
});
