import { useEffect, useRef } from 'react';
import { useText } from '../i18n/LanguageContext.tsx';

interface PageHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
}

// Each page names itself in the tab and takes focus on its title, so a screen reader hears the page change.
export function PageHeader({ eyebrow, title }: PageHeaderProps) {
  const text = useText();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · ${text.app.name}`;
  }, [title, text.app.name]);
  useEffect(() => titleRef.current?.focus(), []);
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 ref={titleRef} tabIndex={-1} className="page-title">
        {title}
      </h1>
    </header>
  );
}
