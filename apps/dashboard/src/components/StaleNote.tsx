import { formatClockTime } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';

// Mounted from the first figures on and empty until a poll fails: a live region only announces text added after it exists.
export function StaleNote({ isStale, updatedAt }: { readonly isStale: boolean; readonly updatedAt: Date }) {
  const { text, language } = useLanguage();
  return (
    <div role="status" className="stale-note">
      {isStale ? (
        <>
          <span>{text.polling.stale}</span> <span>{interpolate(text.polling.lastUpdate, { time: formatClockTime(updatedAt, language) })}</span>
        </>
      ) : null}
    </div>
  );
}
