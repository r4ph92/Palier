import type { MouseEvent, ReactNode, Ref } from 'react';
import { useNavigation } from '../navigation/NavigationContext.tsx';

interface AppLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly linkRef?: Ref<HTMLAnchorElement> | undefined;
}

function opensElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

// A real link, so it can open in a new tab; a plain click stays in the page.
export function AppLink({ href, children, className, linkRef }: AppLinkProps) {
  const { navigate } = useNavigation();
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (opensElsewhere(event)) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={follow} className={className} ref={linkRef}>
      {children}
    </a>
  );
}
