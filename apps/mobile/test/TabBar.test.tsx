import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabBar } from '../src/components/TabBar';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

describe.each<[SupportedLanguage, readonly string[]]>([
  ['fr', ['Stationnements', 'Scanner', 'Compte']],
  ['en', ['Parking lots', 'Scan', 'Account']],
])('TabBar in %s', (language, labels) => {
  it('keeps each label on one line, growing at most 1.4 times with large text', async () => {
    applyLanguage(language);
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <TabBar selected="lots" onSelect={() => undefined} />
      </SafeAreaProvider>,
    );

    for (const label of labels) {
      expect(screen.getByText(label)).toHaveProp('numberOfLines', 1);
      expect(screen.getByText(label)).toHaveProp('adjustsFontSizeToFit', true);
      expect(screen.getByText(label)).toHaveProp('maxFontSizeMultiplier', 1.4);
    }
  });

  it('gives each label the full width of its tab', async () => {
    applyLanguage(language);
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <TabBar selected="lots" onSelect={() => undefined} />
      </SafeAreaProvider>,
    );

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveStyle({ paddingHorizontal: 0 });
    }
  });
});

describe.each<[SupportedLanguage, string]>([
  ['fr', 'Session'],
  ['en', 'Session'],
])('TabBar in %s with a current session', (language, label) => {
  it('names the scan tab after the session, still among three tabs', async () => {
    applyLanguage(language);
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <TabBar selected="scan" onSelect={() => undefined} hasCurrentSession />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('tab', { name: label, selected: true })).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
