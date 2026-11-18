import { render, screen } from '@testing-library/react-native';
import { FreeSpotCount } from '../src/components/FreeSpotCount';
import { applyLanguage } from '../src/i18n/i18n';
import { typography } from '../src/theme/typography';

const mockWindow = { width: 402, height: 874, scale: 3, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const INDICATOR_SIZE = 8;

describe.each([1, 2.3, 3.1])('FreeSpotCount at text scale %d', (fontScale) => {
  beforeEach(() => {
    mockWindow.fontScale = fontScale;
    applyLanguage('fr');
  });

  it('starts the row at the top and centres the square on the number line', async () => {
    await render(<FreeSpotCount count={10} />);

    expect(screen.getByTestId('free-spot-count')).toHaveStyle({ alignItems: 'flex-start' });
    expect(screen.getByTestId('free-spot-indicator')).toHaveStyle({ marginTop: (typography.countNumber.lineHeight * fontScale - INDICATOR_SIZE) / 2 });
  });

  it('centres the square on the Complet line, which is shorter than a number line', async () => {
    await render(<FreeSpotCount count={0} />);

    expect(screen.getByTestId('free-spot-indicator')).toHaveStyle({ marginTop: (typography.countState.lineHeight * fontScale - INDICATOR_SIZE) / 2 });
  });

  it('sets the label in the label line height, not the number line height', async () => {
    await render(<FreeSpotCount count={10} />);

    const label = screen.getByText('places libres');
    expect(label.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ lineHeight: typography.countLabel.lineHeight })]));
  });
});

describe('FreeSpotCount for a full lot', () => {
  beforeEach(() => {
    mockWindow.fontScale = 1;
  });

  it.each([
    ['fr', 'Complet', 'Complet, 0 place libre'],
    ['en', 'Full', 'Full, 0 free spots'],
  ] as const)('puts the square before the %s text and keeps "0 free spot" for VoiceOver', async (language, text, label) => {
    applyLanguage(language);
    await render(<FreeSpotCount count={0} />);

    const [first, second] = screen.getByTestId('free-spot-count').children;
    expect(first).toBe(screen.getByTestId('free-spot-indicator'));
    expect(second).toBe(screen.getByText(text));
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });
});
