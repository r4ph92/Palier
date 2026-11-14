import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { pluralFormOf } from '../i18n/plural.ts';
import type { SpotNotice } from './useSpotChanges.ts';

// A change is announced politely beside the list; a refusal takes focus, so a keyboard user continues from it.
export function SpotNoticeLine({ notice }: { readonly notice: SpotNotice | null }) {
  const sentence = useNoticeSentence(notice);
  return (
    <>
      {notice?.kind === 'refused' ? <ErrorNotice code={notice.refusal.code} values={notice.refusal.values} takesFocus /> : null}
      <p role="status" className="spot-notice">
        {sentence === null ? null : <StateMark tone="free" label={sentence} wraps />}
      </p>
    </>
  );
}

function useNoticeSentence(notice: SpotNotice | null): string | null {
  const { text, language } = useLanguage();
  const spots = text.map.spots;
  if (notice === null || notice.kind === 'refused') {
    return null;
  }
  if (notice.kind === 'added') {
    const { count, aisle } = notice.added;
    return interpolate(pluralFormOf(spots.added, count, language), { count: formatCount(count, language), aisle });
  }
  return interpolate(notice.kind === 'saved' ? spots.saved : spots.deleted, { number: notice.number });
}
