import { useEffect, useState } from 'react';

// Moves focus to an element once the render that shows it is on the page: a closed form gives focus back to the button that opened it.
export function useFocusAfterRender(): (elementId: string) => void {
  const [target, setTarget] = useState<{ readonly elementId: string } | null>(null);
  useEffect(() => {
    if (target !== null) {
      document.getElementById(target.elementId)?.focus();
    }
  }, [target]);
  return (elementId) => setTarget({ elementId });
}
