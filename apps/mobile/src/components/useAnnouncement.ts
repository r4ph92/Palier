import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

// A message that appears without a focus change is announced to VoiceOver; null announces nothing.
export function useAnnouncement(message: string | null) {
  useEffect(() => {
    if (message !== null) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
