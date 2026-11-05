import { useEffect, type RefObject } from 'react';
import type { HostInstance } from 'react-native';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';

// Only a hold the driver just took moves VoiceOver to its banner, once: a tab change or a relaunch does not.
export function useFreshHoldFocus(isFresh: boolean, onFreshHoldShown: () => void): RefObject<HostInstance | null> | undefined {
  const focusRef = useAccessibilityFocusOnMount();
  useEffect(() => {
    if (isFresh) {
      onFreshHoldShown();
    }
  }, [isFresh, onFreshHoldShown]);
  return isFresh ? focusRef : undefined;
}
