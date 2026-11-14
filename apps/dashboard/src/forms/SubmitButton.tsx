import { StableLabel } from '../components/StableLabel.tsx';

export type ButtonEmphasis = 'primary' | 'secondary';

interface SubmitButtonProps {
  readonly label: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  // One filled button per view (design.md, move 5): a second form's submit is outlined.
  readonly emphasis?: ButtonEmphasis;
  // Names the button apart from its twins, when every row of a table has one; it starts with the shown label.
  readonly accessibleName?: string;
}

// aria-disabled, not disabled: the button keeps focus while the request is on its way, and the form ignores a second press.
export function SubmitButton({ label, busyLabel, busy, emphasis = 'primary', accessibleName }: SubmitButtonProps) {
  return (
    <button type="submit" className={`${emphasis}-button`} aria-disabled={busy} aria-label={accessibleName}>
      <StableLabel shown={busy ? busyLabel : label} reserved={[label, busyLabel]} />
    </button>
  );
}
