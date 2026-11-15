import { Fragment, type ReactNode } from 'react';

const PLACEHOLDER = /%\{(\w+)\}/;

interface FilledTemplateProps {
  readonly template: string;
  readonly values: Readonly<Record<string, ReactNode>>;
}

// interpolate for nodes: a figure placed in the sentence keeps its own span, so it can be set in mono.
export function FilledTemplate({ template, values }: FilledTemplateProps) {
  const parts = template.split(PLACEHOLDER);
  return <>{parts.map((part, index) => (isPlaceholderName(index) ? <Fragment key={index}>{values[part] ?? `%{${part}}`}</Fragment> : part))}</>;
}

// Splitting on a captured pattern puts each placeholder's name at an odd index, between the text around it.
function isPlaceholderName(index: number): boolean {
  return index % 2 === 1;
}
