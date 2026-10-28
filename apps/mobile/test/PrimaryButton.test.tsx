import { render, screen } from '@testing-library/react-native';
import { PrimaryButton } from '../src/components/PrimaryButton';

describe('PrimaryButton', () => {
  it('lets its label grow at most twice with large text, so a long word stays whole', async () => {
    await render(<PrimaryButton label="Se déconnecter" onPress={() => undefined} />);

    expect(screen.getByText('Se déconnecter')).toHaveProp('maxFontSizeMultiplier', 2);
  });
});
