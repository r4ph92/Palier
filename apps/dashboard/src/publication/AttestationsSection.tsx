import type { LotPublication } from '@palier/shared-types';
import { useText } from '../i18n/LanguageContext.tsx';
import { AttestationForm } from './AttestationForm.tsx';

interface AttestationsSectionProps {
  readonly publication: LotPublication;
  readonly onSaved: (publication: LotPublication) => void;
}

export function AttestationsSection({ publication, onSaved }: AttestationsSectionProps) {
  const text = useText();
  return (
    <section className="section" aria-labelledby="attestations-title">
      <h2 id="attestations-title" className="section-title">
        {text.publication.attestationsTitle}
      </h2>
      <p className="lead">{text.publication.attestationsIntro}</p>
      <AttestationForm lotId={publication.lotId} kind="WIFI" attestation={publication.wifi} onSaved={onSaved} />
      <AttestationForm lotId={publication.lotId} kind="CELLULAR" attestation={publication.cellular} onSaved={onSaved} />
    </section>
  );
}
