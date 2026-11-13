import type { ReactNode } from 'react';

interface FactProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly numeric?: boolean;
}

export function Fact({ label, children, numeric = false }: FactProps) {
  return (
    <div className="fact">
      <dt className="fact-label">{label}</dt>
      <dd className={numeric ? 'fact-value fact-value-number' : 'fact-value'}>{children}</dd>
    </div>
  );
}
