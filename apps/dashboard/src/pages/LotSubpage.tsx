import type { ReactNode } from 'react';
import type { PolledResource } from '../api/usePolledResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure, type RetryableFailureProps } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { StaleNote } from '../components/StaleNote.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { lotPath } from '../navigation/routes.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

export interface LotSubpageText {
  readonly title: string;
  readonly unavailableTitle: string;
  readonly back: string;
}

// A page under one lot (occupancy, map, equipment): the same header, failure and way back for each.
export interface LotSubpage {
  readonly lotId: string;
  readonly text: LotSubpageText;
  readonly loadingRows: number;
}

interface NamedLot {
  readonly lotName: string;
}

export function LotSubpageLoading({ page }: { readonly page: LotSubpage }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={page.text.title} />
      <SkeletonRows count={page.loadingRows} label={text.app.loading} />
    </>
  );
}

// Another operator's lot and a vanished lot read as not found; any other failure offers a retry.
export function LotSubpageFailure({ page, failure }: { readonly page: LotSubpage; readonly failure: RetryableFailureProps }) {
  const text = useText();
  if (failure.code === 'LOT_NOT_FOUND') {
    return <NotFoundPage />;
  }
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={page.text.unavailableTitle} />
      <div className="actions-row">
        <RetryableFailure {...failure} />
        <BackToLot page={page} />
      </div>
    </>
  );
}

interface LotSubpageFrameProps {
  readonly page: LotSubpage;
  readonly lotName: string;
  readonly children: ReactNode;
}

export function LotSubpageFrame({ page, lotName, children }: LotSubpageFrameProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={`${page.text.title} — ${lotName}`} />
      {children}
      <BackToLot page={page} />
    </>
  );
}

interface PolledLotSubpageProps<T extends NamedLot> {
  readonly page: LotSubpage;
  readonly resource: PolledResource<T>;
  readonly children: (value: T) => ReactNode;
}

// The figures stay on screen when a poll fails, under a note that they are no longer current.
export function PolledLotSubpage<T extends NamedLot>({ page, resource, children }: PolledLotSubpageProps<T>) {
  if (resource.status === 'loading') {
    return <LotSubpageLoading page={page} />;
  }
  if (resource.status === 'failed') {
    return <LotSubpageFailure page={page} failure={{ code: resource.error.code, onRetry: resource.retry, isRetrying: resource.isRetrying }} />;
  }
  return (
    <LotSubpageFrame page={page} lotName={resource.value.lotName}>
      <StaleNote isStale={resource.isStale} updatedAt={resource.updatedAt} />
      {children(resource.value)}
    </LotSubpageFrame>
  );
}

function BackToLot({ page }: { readonly page: LotSubpage }) {
  return (
    <AppLink href={lotPath(page.lotId)} className="text-link">
      {page.text.back}
    </AppLink>
  );
}
