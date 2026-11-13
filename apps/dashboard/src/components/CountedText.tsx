import { formatCount } from '../i18n/formatNumbers.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';

const COUNT_PLACEHOLDER = '%{count}';

interface CountedTextProps {
  readonly template: string;
  readonly count: number;
  readonly figureClassName?: string;
}

// The sentence stays in the text font; only the figure is set as a tabular mono number (design.md, signature move 3).
export function CountedText({ template, count, figureClassName = 'figure' }: CountedTextProps) {
  const { language } = useLanguage();
  const [before = '', after = ''] = template.split(COUNT_PLACEHOLDER);
  return (
    <>
      {before}
      <span className={figureClassName}>{formatCount(count, language)}</span>
      {after}
    </>
  );
}
