import { render, screen } from '@testing-library/react-native';
import { VehicleNeedsFields } from '../src/components/VehicleNeedsFields';
import { applyLanguage } from '../src/i18n/i18n';
import { standardNeeds } from './fakeVehicleClient';

const mockWindow = { width: 402, height: 874, scale: 3, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

describe('VehicleNeedsFields', () => {
  beforeEach(() => applyLanguage('fr'));

  it('shows an empty box beside each need that is not ticked', async () => {
    mockWindow.fontScale = 1;
    await render(<VehicleNeedsFields needs={standardNeeds} onToggle={jest.fn()} />);

    expect(screen.getByTestId('need-box-hasAccessiblePermit')).toHaveStyle({ borderWidth: 2 });
    expect(screen.getByTestId('need-hasAccessiblePermit')).toHaveStyle({ flexDirection: 'row' });
  });

  it.each([2.3, 3.1])('puts the box above the label at text scale %d, so the label keeps the full width', async (fontScale) => {
    mockWindow.fontScale = fontScale;
    await render(<VehicleNeedsFields needs={standardNeeds} onToggle={jest.fn()} />);

    expect(screen.getByTestId('need-hasAccessiblePermit')).not.toHaveStyle({ flexDirection: 'row' });
    expect(screen.getByText('Vignette pour personnes handicapées')).toBeOnTheScreen();
  });
});
