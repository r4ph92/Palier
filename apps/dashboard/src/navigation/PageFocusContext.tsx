import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

type HasUserActed = () => boolean;

const PageFocusContext = createContext<HasUserActed | null>(null);

const ACTION_EVENTS = ['pointerdown', 'keydown', 'popstate'] as const;

// Until the person clicks, types or goes back, a page is the one the browser loaded: its title is not focused, so Tab starts at the skip link.
export function PageFocusProvider({ children }: { readonly children: ReactNode }) {
  const userActed = useRef(false);
  useEffect(() => {
    const markActed = () => {
      userActed.current = true;
    };
    ACTION_EVENTS.forEach((eventName) => window.addEventListener(eventName, markActed, { capture: true }));
    return () => ACTION_EVENTS.forEach((eventName) => window.removeEventListener(eventName, markActed, { capture: true }));
  }, []);
  const hasUserActed = useCallback(() => userActed.current, []);
  return <PageFocusContext.Provider value={hasUserActed}>{children}</PageFocusContext.Provider>;
}

export function useHasUserActed(): HasUserActed {
  const hasUserActed = useContext(PageFocusContext);
  if (hasUserActed === null) {
    throw new Error('useHasUserActed must be used inside PageFocusProvider.');
  }
  return hasUserActed;
}
