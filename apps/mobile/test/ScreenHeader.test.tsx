import { render, screen } from '@testing-library/react-native';
import { ScreenHeader } from '../src/components/ScreenHeader';

describe('ScreenHeader', () => {
  it('opens the ink rule under the title with a short signage yellow bar', async () => {
    await render(<ScreenHeader eyebrow="Session en cours" title="Garage Roy" />);

    expect(screen.getByRole('header', { name: 'Garage Roy' })).toBeOnTheScreen();
    expect(screen.getByTestId('header-mark')).toHaveStyle({ backgroundColor: '#F5C400', width: 56, left: 0 });
  });
});
