import type { Translations } from './fr';
import { exitEn } from './exitEn';
import { spotTakenEn } from './spotTakenEn';
import { whereParkedEn } from './whereParkedEn';

const spotPanelEn: Translations['session']['spotPanel'] = { eyebrow: 'Your spot', place: 'Level\u00A0%{level} · Aisle\u00A0%{aisle}' };

export const sessionPartsEn: Pick<Translations['session'], 'whereParked' | 'spotTaken' | 'exit' | 'spotPanel'> = {
  whereParked: whereParkedEn,
  spotTaken: spotTakenEn,
  exit: exitEn,
  spotPanel: spotPanelEn,
};
