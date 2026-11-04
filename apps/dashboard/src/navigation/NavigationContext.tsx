import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { routeOf, type Route } from './routes.ts';

interface Navigation {
  readonly route: Route;
  readonly navigate: (path: string) => void;
}

const NavigationContext = createContext<Navigation | null>(null);

// Four pages do not need a router library: the path is the state, and the back button replays it through popstate.
export function NavigationProvider({ children }: { readonly children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const replay = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', replay);
    return () => window.removeEventListener('popstate', replay);
  }, []);
  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setPathname(path);
  }, []);
  const navigation = useMemo(() => ({ route: routeOf(pathname), navigate }), [pathname, navigate]);
  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): Navigation {
  const navigation = useContext(NavigationContext);
  if (navigation === null) {
    throw new Error('useNavigation must be used inside NavigationProvider.');
  }
  return navigation;
}
