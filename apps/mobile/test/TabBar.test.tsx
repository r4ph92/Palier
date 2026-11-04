import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabBar } from '../src/components/TabBar';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

describe.each<[SupportedLanguage, string, string]>([
  ['fr', 'Stationnements', 'Compte'],
  ['en', 'Parking lots', 'Account'],
])('TabBar in %s', (language, lotsLabel, accountLabel) => {
  it('keeps each label on one line, growing at most 1.4 times with large text', async () => {
    applyLanguage(language);
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <TabBar selected="lots" onSelect={() => undefined} />
      </SafeAreaProvider>,
    );

    for (const label of [lotsLabel, accountLabel]) {
      expect(screen.getByText(label)).toHaveProp('numberOfLines', 1);
      expect(screen.getByText(label)).toHaveProp('adjustsFontSizeToFit', true);
      expect(screen.getByText(label)).toHaveProp('maxFontSizeMultiplier', 1.4);
    }
  });
});
