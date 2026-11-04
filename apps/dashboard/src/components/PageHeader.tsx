import { useEffect, useRef, type RefObject } from 'react';
import { useText } from '../i18n/LanguageContext.tsx';
import { useHasUserActed } from '../navigation/PageFocusContext.tsx';

interface PageHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
}

function useDocumentTitle(title: string): void {
  const appName = useText().app.name;
  useEffect(() => {
    document.title = `${title} · ${appName}`;
  }, [title, appName]);
}

// After a page change the title takes focus, so a screen reader hears the change; the page the browser loaded keeps focus where it is.
function useTitleFocusAfterPageChange(titleRef: RefObject<HTMLHeadingElement | null>): void {
  const hasUserActed = useHasUserActed();
  useEffect(() => {
    if (hasUserActed()) {
      titleRef.current?.focus();
    }
  }, [hasUserActed, titleRef]);
}

export function PageHeader({ eyebrow, title }: PageHeaderProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useDocumentTitle(title);
  useTitleFocusAfterPageChange(titleRef);
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 ref={titleRef} tabIndex={-1} className="page-title">
        {title}
      </h1>
    </header>
  );
}
