import { render, screen } from '@testing-library/react-native';
import { PrimaryButton } from '../src/components/PrimaryButton';

describe('PrimaryButton', () => {
  it('lets its label grow at most twice with large text, so a long word stays whole', async () => {
    await render(<PrimaryButton label="Se déconnecter" onPress={() => undefined} />);

    expect(screen.getByText('Se déconnecter')).toHaveProp('maxFontSizeMultiplier', 2);
  });

  it('reads its busy label while busy', async () => {
    await render(<PrimaryButton label="Confirmer B-3" busyLabel="Envoi…" busy onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Envoi…' })).toBeDisabled();
    expect(screen.getByText('Envoi…')).toBeOnTheScreen();
  });

  it('keeps the width of its longer label while busy', async () => {
    await render(<PrimaryButton label="Confirmer B-3" busyLabel="Envoi…" busy onPress={() => undefined} />);

    expect(screen.getByText('Confirmer B-3', { includeHiddenElements: true })).toHaveStyle({ opacity: 0 });
  });
});
