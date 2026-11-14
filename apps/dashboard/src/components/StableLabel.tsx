interface StableLabelProps {
  readonly shown: string;
  // Every label the button may show: each takes room, hidden, so the button keeps the width of the widest.
  readonly reserved: readonly string[];
}

// The button does not change width under the cursor while it shows a shorter or a longer label.
export function StableLabel({ shown, reserved }: StableLabelProps) {
  return (
    <span className="stable-label">
      <span>{shown}</span>
      {reserved.map((label, index) => (
        <span key={index} className="stable-label-reserve" aria-hidden="true">
          {label}
        </span>
      ))}
    </span>
  );
}
