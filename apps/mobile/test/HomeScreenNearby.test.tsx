import { screen, within } from '@testing-library/react-native';
import { NO_BREAK_SPACE } from '../src/i18n/spaces';
import { AccessibilityInfo } from 'react-native';
import { FakeDeviceLocationClient, LOCATION_DENIED_NOTICE_FR } from './fakeDeviceLocationClient';
import { FakeLotsClient, PARKING_DEMO_CATEGORY_LINE_FR, parkingDemo, parkingTestPaliers } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';
import { visibleText } from './visibleText';

function lotNamesInOrder(): string[] {
  return screen.getAllByTestId(/^lot-row-/).map((row) => row.props.accessibilityLabel.split(', ')[0]);
}

describe('HomeScreen with location allowed', () => {
  it('lists the lots nearest first with their distance and free spots by category', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingTestPaliers, parkingDemo(10)]));

    expect(await screen.findByText('350 m', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('570 m', visibleText)).toBeOnTheScreen();
    expect(screen.getByText(PARKING_DEMO_CATEGORY_LINE_FR, visibleText)).toBeOnTheScreen();
    expect(lotNamesInOrder()).toEqual(['Parking Démo', 'Parking Test Paliers']);
  });

  it('runs the categories under the name and the count, with each label kept on one line', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]));

    const categories = await screen.findByText(PARKING_DEMO_CATEGORY_LINE_FR, visibleText);
    expect(categories.props.children).toContain(`Grand${NO_BREAK_SPACE}gabarit${NO_BREAK_SPACE}1`);
    expect(within(screen.getByTestId(`lot-summary-${parkingDemo(10).id}`)).queryByText(PARKING_DEMO_CATEGORY_LINE_FR, visibleText)).toBeNull();
  });

  it('shows placeholder rows shaped like a lot while the position is asked', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'fr', new FakeDeviceLocationClient('pending'));

    expect(screen.getAllByTestId('lot-placeholder')).toHaveLength(3);
  });

  it('leaves out a lot further than 10 km', async () => {
    const quebecCity = { ...parkingTestPaliers, name: 'Garage Québec', location: { latitude: 46.8139, longitude: -71.208 } };

    await renderHomeScreen(new FakeLotsClient([parkingDemo(10), quebecCity]));

    await screen.findByText('Parking Démo');
    expect(screen.queryByText('Garage Québec')).not.toBeOnTheScreen();
  });

  it('shows the total and the category counts the API sends, as they are', async () => {
    const twoLeftByCounter = { ...parkingDemo(10), freeSpots: 2, freeSpotsByCategory: { standard: 2, electric: 1, accessible: 1, oversize: 1 } };

    await renderHomeScreen(new FakeLotsClient([twoLeftByCounter]));

    expect(await screen.findByText('2 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Standard 2 · Électrique 1 · Accessible 1 · Grand gabarit 1', visibleText)).toBeOnTheScreen();
  });

  it('shows a full lot as Complet with its distance and no category', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(0)]));

    expect(await screen.findByText('Complet')).toBeOnTheScreen();
    expect(screen.getByText('350 m', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(/Standard/)).not.toBeOnTheScreen();
  });

  it('reads the whole row to VoiceOver', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(2)]));

    expect(await screen.findByLabelText('Parking Démo, 350 mètres, 2 places libres, Standard 2, Électrique 1, Accessible 1, Grand gabarit 1')).toBeOnTheScreen();
  });

  it('reads a full lot to VoiceOver as Complet', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(0)]));

    expect(await screen.findByLabelText('Parking Démo, 350 mètres, Complet, 0 place libre')).toBeOnTheScreen();
  });

  it('shows no location notice', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]));

    await screen.findByText('Parking Démo');
    expect(screen.queryByText(/localisation|Position introuvable/)).not.toBeOnTheScreen();
  });
});

describe('HomeScreen with location denied', () => {
  it('keeps the name order, shows no distance and says how to sort by distance', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10), parkingTestPaliers]), 'fr', new FakeDeviceLocationClient('denied'));

    expect(await screen.findByText(LOCATION_DENIED_NOTICE_FR)).toBeOnTheScreen();
    expect(lotNamesInOrder()).toEqual(['Parking Démo', 'Parking Test Paliers']);
    expect(screen.queryByText(/\d m$/, visibleText)).not.toBeOnTheScreen();
    expect(screen.getByText(PARKING_DEMO_CATEGORY_LINE_FR, visibleText)).toBeOnTheScreen();
  });

  it('lists a lot without coordinates', async () => {
    const withoutLocation = { ...parkingTestPaliers, location: null };

    await renderHomeScreen(new FakeLotsClient([withoutLocation]), 'fr', new FakeDeviceLocationClient('denied'));

    expect(await screen.findByText('Parking Test Paliers')).toBeOnTheScreen();
  });

  it('announces the notice to VoiceOver once', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();

    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'fr', new FakeDeviceLocationClient('denied'));
    await screen.findByText(LOCATION_DENIED_NOTICE_FR);

    expect(announce.mock.calls.filter(([message]) => message === LOCATION_DENIED_NOTICE_FR)).toHaveLength(1);
    announce.mockRestore();
  });

  it('counts a failed permission request as denied', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'fr', new FakeDeviceLocationClient('failing'));

    expect(await screen.findByText(LOCATION_DENIED_NOTICE_FR)).toBeOnTheScreen();
    jest.mocked(console.warn).mockRestore();
  });
});

describe('HomeScreen when the position is unavailable', () => {
  it('sorts by name and says the position was not found', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'fr', new FakeDeviceLocationClient('granted', null));

    expect(await screen.findByText('Position introuvable : stationnements triés par nom', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('350 m', visibleText)).not.toBeOnTheScreen();
  });
});

describe('HomeScreen nearby lots in English', () => {
  it('writes the categories and distances in English', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'en');

    expect(await screen.findByText('Standard 7 · EV 1 · Accessible 1 · Oversize 1', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('350 m', visibleText)).toBeOnTheScreen();
    expect(screen.getByLabelText('Parking Démo, 350 metres, 10 free spots, Standard 7, EV 1, Accessible 1, Oversize 1')).toBeOnTheScreen();
  });

  it('writes a distance over a kilometre with a decimal point', async () => {
    const lotFurtherNorth = { ...parkingTestPaliers, location: { latitude: 45.5156, longitude: -73.5673 } };

    await renderHomeScreen(new FakeLotsClient([lotFurtherNorth]), 'en');

    expect(await screen.findByText('1.2 km', visibleText)).toBeOnTheScreen();
  });

  it.each([
    ['denied', null, 'Turn on location to sort by distance'],
    ['granted', null, 'Location unavailable: lots sorted by name'],
  ] as const)('shows the %s location notice in English', async (permission, position, notice) => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'en', new FakeDeviceLocationClient(permission, position));

    expect(await screen.findByText(notice)).toBeOnTheScreen();
  });

  it('says no lot is online within 10 km', async () => {
    await renderHomeScreen(new FakeLotsClient([]), 'en');

    expect(await screen.findByText('No lot online within 10 km.', visibleText)).toBeOnTheScreen();
  });
});
