import archivoSemiBold from './sheetFonts/archivo-600-latin1.woff?inline';
import plexMonoMedium from './sheetFonts/ibm-plex-mono-500-latin1.woff2?inline';

// The file is opened from disk, offline: the two faces it prints travel inside it, Latin only (decision 038).
const SHEET_FONTS = `
@font-face { font-family: Archivo; font-weight: 600; src: url(${archivoSemiBold}) format('woff'); }
@font-face { font-family: 'IBM Plex Mono'; font-weight: 500; src: url(${plexMonoMedium}) format('woff2'); }
`;

// At least 40 mm across for a phone held at arm's length; black on white paper, whatever the dashboard's theme.
export const SHEET_STYLE = `${SHEET_FONTS}
@page { margin: 15mm; }
body { margin: 0; padding: 24px; font-family: Archivo, system-ui, sans-serif; font-weight: 600; color: #000; background: #fff; text-align: center; }
.eyebrow { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; }
h1 { margin: 8px 0; font-size: 32px; font-weight: 600; }
.direction { margin: 4px 0; font-size: 20px; }
.qr { display: block; width: 80mm; height: 80mm; margin: 16px auto; }
.scan { margin: 4px 0; font-size: 20px; }
.link { margin-top: 24px; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 500; font-size: 12px; overflow-wrap: anywhere; }
`;
