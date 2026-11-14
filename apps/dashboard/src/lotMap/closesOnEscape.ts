import type { KeyboardEvent } from 'react';

// Escape backs out of a question or a form opened from a row, as a dialog would.
export function closesOnEscape(event: KeyboardEvent, close: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  }
}
