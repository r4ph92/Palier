import { useEffect, useRef, type RefObject } from 'react';

// Focuses the element once the condition becomes true: on mount for a question that just opened, after a cancel for the button that opened it.
export function useFocusWhen<Element extends HTMLElement>(condition: boolean): RefObject<Element | null> {
  const elementRef = useRef<Element>(null);
  useEffect(() => {
    if (condition) {
      elementRef.current?.focus();
    }
  }, [condition]);
  return elementRef;
}
