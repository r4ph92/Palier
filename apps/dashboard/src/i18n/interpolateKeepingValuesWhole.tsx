import type { ReactNode } from 'react';

const PLACEHOLDER = /%\{(\w+)\}/g;

// Like interpolate, but a filled value never breaks across lines: a spot number « B-4 » wraps whole or not at all.
export function interpolateKeepingValuesWhole(template: string, values: Readonly<Record<string, string>>): ReactNode {
  return template.split(PLACEHOLDER).map((part, index) => {
    if (index % 2 === 0) {
      return part;
    }
    const value = values[part];
    return value === undefined ? `%{${part}}` : <span key={index} className="no-break">{value}</span>;
  });
}
