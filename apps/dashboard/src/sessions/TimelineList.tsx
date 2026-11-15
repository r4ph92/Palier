import type { TimelineEntry } from '@palier/shared-types/sessionTimeline';
import { formatClockTimeWithSeconds } from '../i18n/formatNumbers.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { timelineLinesOf } from './timelineLines.tsx';

export function TimelineList({ timeline }: { readonly timeline: readonly TimelineEntry[] }) {
  const { text, language } = useLanguage();
  const wording = { steps: text.sessions.steps, language };
  return (
    <ol className="timeline">
      {timeline.flatMap((entry) => timelineLinesOf(entry, wording)).map(({ key, occurredAt, label }) => (
        <li key={key} className="timeline-step">
          <time dateTime={occurredAt} className="timeline-time figure">
            {formatClockTimeWithSeconds(new Date(occurredAt), language)}
          </time>
          <span className="timeline-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
