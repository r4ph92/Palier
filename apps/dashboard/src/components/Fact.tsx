import type { ReactNode } from 'react';

export function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="fact">
      <dt className="fact-label">{label}</dt>
      <dd className="fact-value">{children}</dd>
    </div>
  );
}
