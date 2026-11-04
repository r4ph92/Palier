import type { MouseEvent, ReactNode } from 'react';
import { useNavigation } from '../navigation/NavigationContext.tsx';

interface AppLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
}

function opensElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

// A real link, so it can open in a new tab; a plain click stays in the page.
export function AppLink({ href, children, className }: AppLinkProps) {
  const { navigate } = useNavigation();
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (opensElsewhere(event)) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={follow} className={className}>
      {children}
    </a>
  );
}
