import type { SpotCategory } from '@palier/shared-types';

export interface SpotFlags {
  readonly isEv: boolean;
  readonly isAccessible: boolean;
  readonly isOversize: boolean;
}

// A spot with two flags belongs to both categories; standard means no flag at all.
const CATEGORY_MEMBERSHIP: Readonly<Record<SpotCategory, (flags: SpotFlags) => boolean>> = {
  standard: ({ isEv, isAccessible, isOversize }) => !isEv && !isAccessible && !isOversize,
  electric: ({ isEv }) => isEv,
  accessible: ({ isAccessible }) => isAccessible,
  oversize: ({ isOversize }) => isOversize,
};

export function isInCategory(flags: SpotFlags, category: SpotCategory): boolean {
  return CATEGORY_MEMBERSHIP[category](flags);
}
