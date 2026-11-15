import { encode } from 'uqr';

// Medium error correction survives a scuffed or partly shaded sticker; four light modules around it are the quiet zone scanners need.
const ERROR_CORRECTION = 'M';
export const QUIET_ZONE_MODULES = 4;

export interface QrModules {
  readonly size: number;
  // One SVG path drawing every dark module as a one-unit square.
  readonly darkPath: string;
}

export function qrModulesOf(link: string): QrModules {
  const { size, data } = encode(link, { ecc: ERROR_CORRECTION, border: QUIET_ZONE_MODULES });
  const squares = data.flatMap((row, y) => row.flatMap((isDark, x) => (isDark ? [`M${x} ${y}h1v1h-1z`] : [])));
  return { size, darkPath: squares.join('') };
}
