import { SESSION_LIST_STATUSES, type SessionListStatus } from '@palier/shared-types/sessionTimeline';
import { useText } from '../i18n/LanguageContext.tsx';

interface StatusFilterProps {
  readonly status: SessionListStatus;
  readonly onChange: (status: SessionListStatus) => void;
}

export function StatusFilter({ status, onChange }: StatusFilterProps) {
  const { sessions } = useText();
  return (
    <div role="group" aria-label={sessions.filterLabel} className="status-filter">
      {SESSION_LIST_STATUSES.map((wanted) => (
        <button key={wanted} type="button" className="status-filter-button" aria-pressed={wanted === status} onClick={() => onChange(wanted)}>
          {sessions.filter[wanted]}
        </button>
      ))}
    </div>
  );
}
