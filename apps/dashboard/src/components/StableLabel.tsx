interface StableLabelProps {
  readonly shown: string;
  readonly widest: string;
}

// The button keeps the width of its widest label, so it does not shrink under the cursor while it shows a shorter one.
export function StableLabel({ shown, widest }: StableLabelProps) {
  return (
    <span className="stable-label">
      <span>{shown}</span>
      <span className="stable-label-reserve" aria-hidden="true">
        {widest}
      </span>
    </span>
  );
}
