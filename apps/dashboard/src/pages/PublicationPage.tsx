import type { LotPublication } from '@palier/shared-types';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { AttestationsSection } from '../publication/AttestationsSection.tsx';
import { checklistLinesOf, missingNamesOf } from '../publication/checklistLines.ts';
import { ChecklistSection } from '../publication/ChecklistSection.tsx';
import { OnlineSection } from '../publication/OnlineSection.tsx';
import { useLotPublication } from '../publication/useLotPublication.ts';
import { PolledLotSubpage } from './LotSubpage.tsx';

const LOADING_ROWS = 6;

export function PublicationPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const { resource, show, refresh } = useLotPublication(lotId);
  return (
    <PolledLotSubpage page={{ lotId, text: text.publication, loadingRows: LOADING_ROWS }} resource={resource}>
      {(publication) => <PublicationView publication={publication} onSaved={show} onStale={refresh} />}
    </PolledLotSubpage>
  );
}

interface PublicationViewProps {
  readonly publication: LotPublication;
  readonly onSaved: (publication: LotPublication) => void;
  readonly onStale: () => Promise<boolean>;
}

// The state and its one action first, then why it is or is not ready, then the measures only the operator can enter.
function PublicationView({ publication, onSaved, onStale }: PublicationViewProps) {
  const { text, language } = useLanguage();
  const lines = checklistLinesOf(publication, { text, language, now: new Date() });
  return (
    <>
      <p className="lead">{text.publication.intro}</p>
      <OnlineSection publication={publication} missingNames={missingNamesOf(lines, language)} onSaved={onSaved} onStale={onStale} />
      <ChecklistSection lines={lines} />
      <AttestationsSection publication={publication} onSaved={onSaved} />
    </>
  );
}
