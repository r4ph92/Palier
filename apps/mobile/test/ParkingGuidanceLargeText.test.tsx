import type { PlanAisle } from '@palier/shared-types';
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { applyLanguage } from '../src/i18n/i18n';
import { fontFamilies } from '../src/theme/tokens';
import { ParkingGuidance } from '../src/screens/ParkingGuidance';
import { julieAtB3, parkingDemoP1Plan } from './fakeParkingSessionClient';
import { visibleText } from './visibleText';

const mockWindow = { width: 375, height: 812, scale: 3, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const aisleA = parkingDemoP1Plan.aisles[0] as PlanAisle;
// The legend repeats the image label, so it is hidden from VoiceOver but seen.
const seenOnly = { ...visibleText, includeHiddenElements: true };

describe.each([1.35, 2.3, 3.1])('the level plan at text scale %d', (fontScale) => {
  beforeEach(() => {
    applyLanguage('fr');
    mockWindow.fontScale = fontScale;
  });

  it('keeps only the aisle names inside the rectangles and lists the markers under the drawing', async () => {
    await render(<ParkingGuidance session={julieAtB3()} currentAisle={aisleA} />);

    expect(within(screen.getByTestId('PlanAisle-B')).getByText('Allée B')).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-B')).queryByText('Place B-3', visibleText)).toBeNull();
    expect(within(screen.getByTestId('PlanAisle-A')).queryByText('Vous êtes ici')).toBeNull();
    expect(screen.getByText('Allée B · Place B-3', seenOnly)).toBeOnTheScreen();
    expect(screen.getByText('Allée A · Vous êtes ici', seenOnly)).toBeOnTheScreen();
    expect(screen.queryByText('Allée B · Place B-3', visibleText)).toBeNull();
    expect(StyleSheet.flatten(screen.getByText('B-3', seenOnly).props.style).fontFamily).toBe(fontFamilies.mono);
  });
});

describe('the level plan at the default text scale', () => {
  it('lists no markers under the drawing', async () => {
    mockWindow.fontScale = 1;
    applyLanguage('fr');

    await render(<ParkingGuidance session={julieAtB3()} currentAisle={aisleA} />);

    expect(screen.queryByText('Allée B · Place B-3', seenOnly)).toBeNull();
  });
});
