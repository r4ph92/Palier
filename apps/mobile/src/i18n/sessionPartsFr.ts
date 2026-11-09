import { exitFr } from './exitFr';
import { spotTakenFr } from './spotTakenFr';
import { whereParkedFr } from './whereParkedFr';

// The session screen's own flows, kept apart so fr.ts stays short.
export const sessionPartsFr = { whereParked: whereParkedFr, spotTaken: spotTakenFr, exit: exitFr };
