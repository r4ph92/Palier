import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

// A message that appears without a focus change is announced to VoiceOver; null announces nothing.
// A new repeatKey announces the same message again.
export function useAnnouncement(message: string | null, repeatKey = 0) {
  useEffect(() => {
    if (message !== null) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message, repeatKey]);
}
