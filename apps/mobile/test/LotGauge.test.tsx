import type { LotSummary } from '@palier/shared-types';
import { render, screen } from '@testing-library/react-native';
import { LotGauge } from '../src/components/LotGauge';
import { LotRow } from '../src/components/LotRow';
import { applyLanguage } from '../src/i18n/i18n';
import { lightColors } from '../src/theme/tokens';

const garageRoy: LotSummary = {
  id: 'garage-roy',
  name: 'Garage Roy',
  freeSpots: 42,
  capacity: 120,
  freeSpotsByCategory: { standard: 34, electric: 6, accessible: 2, oversize: 0 },
  location: null,
};

describe('LotGauge', () => {
  it('fills the share of the lot still free and shows free over capacity', async () => {
    await render(<LotGauge freeSpots={42} capacity={120} />);

    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ width: '35%', backgroundColor: lightColors.free });
    expect(screen.getByText('42 / 120')).toBeOnTheScreen();
  });

  it('stays free at exactly a quarter of the lot free', async () => {
    await render(<LotGauge freeSpots={25} capacity={100} />);

    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ backgroundColor: lightColors.free });
  });

  it('turns low under a quarter of the lot free', async () => {
    await render(<LotGauge freeSpots={24} capacity={100} />);

    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ width: '24%', backgroundColor: lightColors.low });
  });

  it('draws an empty gauge for a full lot', async () => {
    await render(<LotGauge freeSpots={0} capacity={60} />);

    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ width: '0%' });
    expect(screen.getByText('0 / 60')).toBeOnTheScreen();
  });

  it('draws an empty gauge for a lot with no spot at all', async () => {
    await render(<LotGauge freeSpots={0} capacity={0} />);

    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ width: '0%' });
  });

  it('shows a negative count as 0, like the count beside it', async () => {
    await render(<LotGauge freeSpots={-3} capacity={10} />);

    expect(screen.getByText('0 / 10')).toBeOnTheScreen();
    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ width: '0%' });
  });

  it('never overflows when the count passes the capacity', async () => {
    await render(<LotGauge freeSpots={12} capacity={10} />);

    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ width: '100%' });
  });
});

describe('LotRow with its gauge', () => {
  it('reads the free spots out of the capacity in French', async () => {
    applyLanguage('fr');
    await render(<LotRow nearbyLot={{ lot: garageRoy, distanceMetres: null }} />);

    expect(screen.getByLabelText('Garage Roy, 42 places libres sur 120, Standard 34, Électrique 6, Accessible 2, Grand gabarit 0')).toBeOnTheScreen();
    expect(screen.getByTestId('lot-gauge')).toBeOnTheScreen();
  });

  it('reads the free spots out of the capacity in English', async () => {
    applyLanguage('en');
    await render(<LotRow nearbyLot={{ lot: garageRoy, distanceMetres: null }} />);

    expect(screen.getByLabelText(/^Garage Roy, 42 free spots out of 120, /)).toBeOnTheScreen();
  });

  it('shows Complet with an empty gauge for a full lot', async () => {
    applyLanguage('fr');
    await render(<LotRow nearbyLot={{ lot: { ...garageRoy, freeSpots: 0 }, distanceMetres: null }} />);

    expect(screen.getByText('Complet')).toBeOnTheScreen();
    expect(screen.getByTestId('lot-gauge-fill')).toHaveStyle({ width: '0%' });
  });
});
