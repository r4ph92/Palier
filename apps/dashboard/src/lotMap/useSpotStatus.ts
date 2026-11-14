import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { pluralFormOf } from '../i18n/plural.ts';
import { LIST_OUT_OF_DATE } from './spotFormValues.ts';

interface SpotStatusSources {
  readonly show: (spots: DashboardAisleSpots) => void;
  readonly refresh: () => Promise<boolean>;
  readonly onStale: () => Promise<boolean>;
}

export interface AddedSpots {
  readonly count: number;
  readonly aisle: string;
}

export interface SpotStatus {
  // The sentence the status line announces after the last change; null before any.
  readonly message: string | null;
  readonly added: (spots: DashboardAisleSpots, added: AddedSpots) => void;
  readonly saved: (spots: DashboardAisleSpots, spot: DashboardSpot) => void;
  readonly deleted: (spots: DashboardAisleSpots, spot: DashboardSpot) => void;
  // Reads the list again, or the map for an aisle gone, after a refusal that says the page is out of date.
  readonly refused: (code: DisplayedErrorCode) => void;
}

// Every write shows the aisle's spots as the API answered them, then says what changed.
export function useSpotStatus({ show, refresh, onStale }: SpotStatusSources): SpotStatus {
  const { text, language } = useLanguage();
  const [message, setMessage] = useState<string | null>(null);
  const showWith = (spots: DashboardAisleSpots, sentence: string) => {
    show(spots);
    setMessage(sentence);
  };
  const addedSentence = ({ count, aisle }: AddedSpots) => interpolate(pluralFormOf(text.map.spots.added, count, language), { count: formatCount(count, language), aisle });
  return {
    message,
    added: (spots, added) => showWith(spots, addedSentence(added)),
    saved: (spots, spot) => showWith(spots, interpolate(text.map.spots.saved, { number: spot.number })),
    deleted: (spots, spot) => showWith(spots, interpolate(text.map.spots.deleted, { number: spot.number })),
    refused: (code) => void followUpRefusal(code, { refresh, onStale }),
  };
}

function followUpRefusal(code: DisplayedErrorCode, { refresh, onStale }: Omit<SpotStatusSources, 'show'>): Promise<boolean> | null {
  if (code === 'AISLE_NOT_FOUND') {
    return onStale();
  }
  return LIST_OUT_OF_DATE.includes(code) ? refresh() : null;
}
