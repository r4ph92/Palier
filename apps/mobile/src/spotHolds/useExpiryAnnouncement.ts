import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

// Announced once, when the countdown runs out in front of the driver: a banner that opens already expired stays quiet.
export function useExpiryAnnouncement(isExpired: boolean, message: string): void {
  const sawTimeLeft = useRef(!isExpired);
  useEffect(() => {
    if (!isExpired) {
      sawTimeLeft.current = true;
      return;
    }
    if (sawTimeLeft.current) {
      sawTimeLeft.current = false;
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [isExpired, message]);
}
