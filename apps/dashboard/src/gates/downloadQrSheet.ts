import { qrSheetHtmlOf, type QrSheetContent } from './QrSheet.tsx';

// Long enough for the browser to start the download before the file's address is released.
const RELEASE_AFTER_MILLISECONDS = 30_000;
const NOT_A_FILE_NAME_CHARACTER = /[^a-z0-9]+/g;
const COMBINING_MARK = /\p{M}/gu;

// A self-contained page the operator opens and prints: nothing it shows is fetched again.
export function downloadQrSheet(content: QrSheetContent): void {
  const url = URL.createObjectURL(new Blob([qrSheetHtmlOf(content)], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = qrSheetFileNameOf(content.gateName);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), RELEASE_AFTER_MILLISECONDS);
}

// « Entrée principale » downloads as qr-entree-principale.html.
export function qrSheetFileNameOf(gateName: string): string {
  const slug = gateName.normalize('NFD').replace(COMBINING_MARK, '').toLowerCase().replace(NOT_A_FILE_NAME_CHARACTER, '-').replace(/^-|-$/g, '');
  return `qr-${slug === '' ? 'borne' : slug}.html`;
}
