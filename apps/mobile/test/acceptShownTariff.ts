import { screen, type userEvent } from '@testing-library/react-native';

type User = ReturnType<typeof userEvent.setup>;

// After a scan, taps « Entrer » on the tariff Palier shows (#151). A refused scan shows no tariff, so nothing is tapped.
export async function acceptShownTariff(user: User): Promise<void> {
  const enter = screen.queryByRole('button', { name: /^(Entrer|Enter)$/ });
  if (enter !== null) {
    await user.press(enter);
  }
}
