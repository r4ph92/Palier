import type { LotExitShares } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';
import { CountedText } from '../components/CountedText.tsx';
import { exitSharesOf, type ExitShare } from '../exits/exitShares.ts';
import { formatPercent } from '../i18n/formatNumbers.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { LotSubpageFailure, LotSubpageFrame, LotSubpageLoading, type LotSubpage } from './LotSubpage.tsx';

const LOADING_ROWS = 2;

// Read once when the page opens: a share over 30 days does not move in the time anyone looks at it.
export function ExitsPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const { resource, reload, isReloading } = useResource(useCallback(() => dashboardClient.exitShares(lotId), [lotId]));
  const page: LotSubpage = { lotId, text: text.exits, loadingRows: LOADING_ROWS };
  if (resource.status === 'loading') {
    return <LotSubpageLoading page={page} />;
  }
  if (resource.status === 'failed') {
    return <LotSubpageFailure page={page} failure={{ code: resource.error.code, onRetry: reload, isRetrying: isReloading }} />;
  }
  return (
    <LotSubpageFrame page={page} lotName={resource.value.lotName}>
      <ExitsView shares={resource.value} />
    </LotSubpageFrame>
  );
}

function ExitsView({ shares }: { readonly shares: LotExitShares }) {
  const { exits: text } = useText();
  if (shares.totalExits === 0) {
    return <p>{text.empty}</p>;
  }
  return (
    <>
      <p className="count-line">
        <CountedText template={text.summary} count={shares.totalExits} />
      </p>
      <ShareList shares={exitSharesOf(shares)} />
      <p className="muted">{text.hint}</p>
    </>
  );
}

// The dots only separate the shares on a wide line: they are hidden from a screen reader, which reads a list.
function ShareList({ shares }: { readonly shares: readonly ExitShare[] }) {
  const { text, language } = useLanguage();
  return (
    <ul className="share-list" aria-label={text.exits.listLabel}>
      {shares.map(({ method, percent }, index) => (
        <li key={method}>
          {text.exits.methods[method]} <span className="figure">{formatPercent(percent, language)}</span>
          {index < shares.length - 1 ? <span aria-hidden="true"> ·</span> : null}{' '}
        </li>
      ))}
    </ul>
  );
}
