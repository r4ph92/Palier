export type StateTone = 'free' | 'danger' | 'muted';

interface StateMarkProps {
  readonly tone: StateTone;
  readonly label: string;
}

// design.md: a state is an 8 pt filled square followed by its word, never a coloured pill.
export function StateMark({ tone, label }: StateMarkProps) {
  return (
    <span className="state-mark">
      <span className={`state-mark-square state-mark-${tone}`} aria-hidden="true" />
      {label}
    </span>
  );
}
