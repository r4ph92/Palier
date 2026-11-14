import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardApiError } from '../src/api/DashboardApiError.ts';
import type { PolledResource } from '../src/api/usePolledResource.ts';
import { fr } from '../src/i18n/fr.ts';
import { LanguageProvider } from '../src/i18n/LanguageContext.tsx';
import { NavigationProvider } from '../src/navigation/NavigationContext.tsx';
import { PageFocusProvider } from '../src/navigation/PageFocusContext.tsx';
import { PolledLotSubpage, type LotSubpage } from '../src/pages/LotSubpage.tsx';

interface Figures {
  readonly lotName: string;
  readonly figure: number;
}

const LOT_ID = 'lot-demo';
const page: LotSubpage = { lotId: LOT_ID, text: fr.equipment, loadingRows: 2 };
const UPDATED_AT = new Date(2026, 10, 13, 14, 5);

function renderSubpage(resource: PolledResource<Figures>) {
  const wrap = (children: ReactNode) => (
    <LanguageProvider>
      <NavigationProvider>
        <PageFocusProvider>{children}</PageFocusProvider>
      </NavigationProvider>
    </LanguageProvider>
  );
  window.localStorage.setItem('palier.language', 'fr');
  return render(wrap(<PolledLotSubpage page={page} resource={resource}>{(value) => <p>Figure {value.figure}</p>}</PolledLotSubpage>));
}

function backLink(): HTMLElement {
  return screen.getByRole('link', { name: 'Retour au stationnement' });
}

describe('the shell every polled page of a lot shares', () => {
  it('frames the figures with the lot name in the title and the way back to the lot', () => {
    renderSubpage({ status: 'ready', value: { lotName: 'Parking Démo', figure: 7 }, isStale: false, updatedAt: UPDATED_AT });

    expect(screen.getByRole('heading', { level: 1, name: 'Équipement — Parking Démo' })).toBeDefined();
    expect(screen.getByText('Figure 7')).toBeDefined();
    expect(backLink().getAttribute('href')).toBe(`/lots/${LOT_ID}`);
    expect(screen.getAllByRole('status').every((status) => status.textContent === '')).toBe(true);
  });

  it('keeps the figures under a stale note when a poll fails', () => {
    renderSubpage({ status: 'ready', value: { lotName: 'Parking Démo', figure: 7 }, isStale: true, updatedAt: UPDATED_AT });

    expect(screen.getByText('Figure 7')).toBeDefined();
    expect(screen.getByText(fr.polling.stale)).toBeDefined();
  });

  it('offers a retry and the way back when the first read fails', () => {
    const retry = vi.fn();
    renderSubpage({ status: 'failed', error: new DashboardApiError(503, 'LOT_BUSY'), retry, isRetrying: false });

    expect(screen.getByRole('heading', { level: 1, name: 'Équipement indisponible' })).toBeDefined();
    screen.getByRole('button', { name: 'Réessayer' }).click();
    expect(retry).toHaveBeenCalledOnce();
    expect(backLink()).toBeDefined();
  });

  it('reads a lot that is gone, or another operator’s, as not found', () => {
    renderSubpage({ status: 'failed', error: new DashboardApiError(404, 'LOT_NOT_FOUND'), retry: vi.fn(), isRetrying: false });

    expect(screen.getByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('shows the page title over loading rows before the first read', () => {
    renderSubpage({ status: 'loading' });

    expect(screen.getByRole('heading', { level: 1, name: 'Équipement' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Retour au stationnement' })).toBeNull();
  });
});
