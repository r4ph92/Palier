import { screen } from '@testing-library/react-native';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';

const mockWindow = { width: 402, height: 874, scale: 3, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

describe.each([1, 1.35, 2.3, 3.1])('HomeScreen at text scale %d', (fontScale) => {
  beforeEach(() => {
    mockWindow.fontScale = fontScale;
  });

  it('keeps the lot name and its count on screen', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)));

    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    expect(screen.getByText('10 places libres')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeOnTheScreen();
  });

  it('stacks the name above the count only at large text sizes', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)));

    await screen.findByText('Parking Démo');

    expect(screen.getByTestId(`lot-row-${parkingDemoWith(10)[0]?.id}`)).toHaveStyle({ flexDirection: fontScale >= 1.35 ? 'column' : 'row' });
  });
});
