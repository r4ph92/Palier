import type { Translations } from './fr';
import { exitEn } from './exitEn';
import { spotTakenEn } from './spotTakenEn';
import { whereParkedEn } from './whereParkedEn';

export const sessionPartsEn: Pick<Translations['session'], 'whereParked' | 'spotTaken' | 'exit'> = { whereParked: whereParkedEn, spotTaken: spotTakenEn, exit: exitEn };
