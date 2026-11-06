import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

interface AnnouncementOptions {
  // Waits for the announcement being read instead of cutting it off.
  readonly queued?: boolean;
}

// A message that appears without a focus change is announced to VoiceOver; null announces nothing.
// A new repeatKey announces the same message again.
export function useAnnouncement(message: string | null, repeatKey = 0, { queued = false }: AnnouncementOptions = {}) {
  useEffect(() => {
    if (message === null) {
      return;
    }
    if (queued) {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    } else {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message, repeatKey, queued]);
}
