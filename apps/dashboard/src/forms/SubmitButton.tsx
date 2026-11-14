import { StableLabel } from '../components/StableLabel.tsx';

export type ButtonEmphasis = 'primary' | 'secondary';

interface SubmitButtonProps {
  readonly label: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  // One filled button per view (design.md, move 5): a second form's submit is outlined.
  readonly emphasis?: ButtonEmphasis;
}

// aria-disabled, not disabled: the button keeps focus while the request is on its way, and the form ignores a second press.
export function SubmitButton({ label, busyLabel, busy, emphasis = 'primary' }: SubmitButtonProps) {
  return (
    <button type="submit" className={`${emphasis}-button`} aria-disabled={busy}>
      <StableLabel shown={busy ? busyLabel : label} reserved={[label, busyLabel]} />
    </button>
  );
}
