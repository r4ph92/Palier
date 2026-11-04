import type { ComponentType } from 'react';

export interface DeveloperEntry {
  readonly label: string;
  readonly Panel: ComponentType<{ readonly onBack: () => void }>;
}
