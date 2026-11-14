import type { ReactNode } from 'react';
import { PLACEHOLDER_PATTERN } from './interpolate.ts';

// Like interpolate, but a filled value never breaks across lines: a spot number « B-4 » wraps whole or not at all.
export function interpolateKeepingValuesWhole(template: string, values: Readonly<Record<string, string>>): ReactNode {
  return template.split(PLACEHOLDER_PATTERN).map((part, index) => {
    if (index % 2 === 0) {
      return part;
    }
    const value = values[part];
    return value === undefined ? `%{${part}}` : <span key={index} className="no-break">{value}</span>;
  });
}
