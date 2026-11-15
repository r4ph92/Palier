import type { GateKind } from '@palier/shared-types';
import { renderToStaticMarkup } from 'react-dom/server';
import { qrModulesOf } from './qrCode.ts';
import { QR_SHEET_TEXT } from './qrSheetText.ts';
import { SHEET_STYLE } from './qrSheetStyle.ts';

export interface QrSheetContent {
  readonly lotName: string;
  readonly gateName: string;
  readonly kind: GateKind;
  readonly link: string;
}

// React escapes every name an operator typed, so a gate named <script> prints as text.
export function qrSheetHtmlOf(content: QrSheetContent): string {
  return `<!doctype html>${renderToStaticMarkup(<QrSheet {...content} />)}`;
}

function QrSheet(content: QrSheetContent) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <title>{`${content.gateName} — ${content.lotName}`}</title>
        <style dangerouslySetInnerHTML={{ __html: SHEET_STYLE }} />
      </head>
      <SheetBody {...content} />
    </html>
  );
}

function SheetBody({ lotName, gateName, kind, link }: QrSheetContent) {
  const direction = QR_SHEET_TEXT.kinds[kind];
  return (
    <body>
      <p className="eyebrow">{lotName}</p>
      <h1>{gateName}</h1>
      <p className="direction">
        {direction.fr} · <span lang="en">{direction.en}</span>
      </p>
      <QrSvg link={link} />
      <p className="scan">{QR_SHEET_TEXT.scan.fr}</p>
      <p className="scan" lang="en">
        {QR_SHEET_TEXT.scan.en}
      </p>
      <p className="link">{link}</p>
    </body>
  );
}

function QrSvg({ link }: { readonly link: string }) {
  const { size, darkPath } = qrModulesOf(link);
  return (
    <svg className="qr" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={QR_SHEET_TEXT.qrName}>
      <rect width={size} height={size} fill="#fff" />
      <path d={darkPath} fill="#000" />
    </svg>
  );
}
