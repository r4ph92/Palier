import type { SavedCard } from '@palier/shared-types';

// Stripe reports the brand in lower case ("visa"); the screen shows it capitalized, then the last four digits.
export function formatCardLabel({ brand, last4 }: SavedCard): string {
  return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${last4}`;
}
