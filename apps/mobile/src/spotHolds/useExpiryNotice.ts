import { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, type HostInstance } from 'react-native';
import { useAnnouncement } from '../components/useAnnouncement';

type ExpiryNotice = 'none' | 'announce' | 'focus';

// When the countdown runs out in front of the driver the message is announced once; a banner that opens already expired stays quiet.
// A driver in the middle of releasing loses those controls at that moment, so VoiceOver moves to the banner instead. Returns its ref.
export function useExpiryNotice(isExpired: boolean, message: string, takesFocus: boolean): RefObject<HostInstance | null> {
  const bannerRef = useRef<HostInstance>(null);
  const [previousIsExpired, setPreviousIsExpired] = useState(isExpired);
  const [notice, setNotice] = useState<ExpiryNotice>('none');
  if (isExpired !== previousIsExpired) {
    setPreviousIsExpired(isExpired);
    setNotice(isExpired ? noticeFor(takesFocus) : 'none');
  }
  useAnnouncement(notice === 'announce' ? message : null);
  useEffect(() => {
    if (notice === 'focus' && bannerRef.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(bannerRef.current, 'focus');
    }
  }, [notice]);
  return bannerRef;
}

function noticeFor(takesFocus: boolean): ExpiryNotice {
  return takesFocus ? 'focus' : 'announce';
}
