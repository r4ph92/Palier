import { useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, type HostInstance } from 'react-native';

// Moves VoiceOver to the element whenever the key turns to a new non-null value, on mount included: a change that
// happens in place, like a new spot on a line already shown, has no mount to hang the focus on.
export function useAccessibilityFocusOn(focusKey: string | null): RefObject<HostInstance | null> {
  const ref = useRef<HostInstance>(null);
  useEffect(() => {
    if (focusKey !== null && ref.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
    }
  }, [focusKey]);
  return ref;
}
