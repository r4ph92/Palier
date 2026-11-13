import type { ReactNode } from 'react';

export type StateTone = 'free' | 'danger' | 'muted';

interface StateMarkProps {
  readonly tone: StateTone;
  readonly label: ReactNode;
  // A sentence wraps on narrow screens; a one-word state stays on one line.
  readonly wraps?: boolean;
}

// design.md: a state is an 8 pt filled square followed by its word, never a coloured pill.
export function StateMark({ tone, label, wraps = false }: StateMarkProps) {
  return (
    <span className={wraps ? 'state-mark state-mark-sentence' : 'state-mark'}>
      <span className={`state-mark-square state-mark-${tone}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
