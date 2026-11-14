import { exitFr } from './exitFr';
import { spotTakenFr } from './spotTakenFr';
import { whereParkedFr } from './whereParkedFr';

// The session screen's own flows, kept apart so fr.ts stays short.
const spotPanelFr = { eyebrow: 'Votre place', place: 'Palier\u00A0%{level} · Allée\u00A0%{aisle}' };

export const sessionPartsFr = { whereParked: whereParkedFr, spotTaken: spotTakenFr, exit: exitFr, spotPanel: spotPanelFr };
