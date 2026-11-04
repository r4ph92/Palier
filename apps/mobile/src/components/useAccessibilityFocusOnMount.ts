import { useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, type HostInstance } from 'react-native';

// A result that replaces the form moves VoiceOver to it, so the driver hears it instead of losing their place.
export function useAccessibilityFocusOnMount(): RefObject<HostInstance | null> {
  const ref = useRef<HostInstance>(null);
  useEffect(() => {
    if (ref.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
    }
  }, []);
  return ref;
}
