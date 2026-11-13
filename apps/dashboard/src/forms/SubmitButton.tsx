import { StableLabel } from '../components/StableLabel.tsx';

interface SubmitButtonProps {
  readonly label: string;
  readonly busyLabel: string;
  readonly busy: boolean;
}

// aria-disabled, not disabled: the button keeps focus while the request is on its way, and the form ignores a second press.
export function SubmitButton({ label, busyLabel, busy }: SubmitButtonProps) {
  return (
    <button type="submit" className="primary-button" aria-disabled={busy}>
      <StableLabel shown={busy ? busyLabel : label} widest={label} />
    </button>
  );
}
