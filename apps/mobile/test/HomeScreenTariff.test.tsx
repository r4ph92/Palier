import { screen } from '@testing-library/react-native';
import { FakeLotsClient, parkingDemo } from './fakeLotsClient';
import { applyLanguage } from '../src/i18n/i18n';
import { tariffLine } from '../src/i18n/tariffText';
import { PARKING_DEMO_TARIFF } from './fakeEntryClient';
import { renderHomeScreen } from './renderHomeScreen';
import { asSeen, visibleText } from './visibleText';

// #151: the tariff shows on the lot list before Julie drives to the barrier.
describe('HomeScreen lot tariff', () => {
  it('shows Parking Démo at « 0,75 $ / 15 min · plafond 25,00 $ par jour »', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]));

    expect(await screen.findByText('0,75 $ / 15 min · plafond 25,00 $ par jour', visibleText)).toBeOnTheScreen();
  });

  it('shows the tariff in English on an English phone, with no French text', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'en');

    expect(await screen.findByText('$0.75 / 15 min · daily cap $25.00', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(/plafond|par jour/, visibleText)).not.toBeOnTheScreen();
  });

  it.each(['fr', 'en'] as const)('in %s, never starts a line with the « · » of the tariff line, even at the largest text', (language) => {
    applyLanguage(language);

    expect(tariffLine(PARKING_DEMO_TARIFF)).toContain('min\u00A0· ');
  });

  it('reads the tariff to VoiceOver with the rest of the row', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]));

    const row = await screen.findByTestId(`lot-row-${parkingDemo(10).id}`);

    expect(asSeen(row.props.accessibilityLabel as string)).toContain('0,75 $ par 15 min, plafond 25,00 $ par jour');
  });

  it('lists a lot whose tariff cannot be read without a tariff line', async () => {
    await renderHomeScreen(new FakeLotsClient([{ ...parkingDemo(10), tariff: null }]));

    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    expect(screen.queryByText(/plafond/, visibleText)).not.toBeOnTheScreen();
  });
});
