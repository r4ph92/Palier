import jsQR from 'jsqr';

const PIXELS_PER_MODULE = 4;
const DARK_MODULE = /M(\d+) (\d+)h1v1h-1z/g;
const RGBA = 4;

export interface ReadSheet {
  readonly document: Document;
  // What a phone reads from the sheet's QR, or null when it reads nothing.
  readonly scanned: string | null;
}

export async function readSheet(sheet: Blob): Promise<ReadSheet> {
  const parsed = new DOMParser().parseFromString(await textOf(sheet), 'text/html');
  const svg = parsed.querySelector('svg.qr');
  const size = Number(svg?.getAttribute('viewBox')?.split(' ')[2] ?? 0);
  const darkPath = svg?.querySelector('path')?.getAttribute('d') ?? '';
  return { document: parsed, scanned: scan(size, darkPath) };
}

// Blob.text is missing from jsdom's Blob.
function textOf(sheet: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(sheet);
  });
}

// Draws the dark modules as the printer would, white everywhere else, and lets jsQR decode the picture.
function scan(size: number, darkPath: string): string | null {
  const width = size * PIXELS_PER_MODULE;
  const canvas = { pixels: new Uint8ClampedArray(width * width * RGBA).fill(255), width };
  for (const [, x, y] of darkPath.matchAll(DARK_MODULE)) {
    paintModule(canvas, { x: Number(x), y: Number(y) });
  }
  return jsQR(canvas.pixels, width, width)?.data ?? null;
}

interface Canvas {
  readonly pixels: Uint8ClampedArray;
  readonly width: number;
}

function paintModule({ pixels, width }: Canvas, module: { readonly x: number; readonly y: number }): void {
  for (let row = 0; row < PIXELS_PER_MODULE; row += 1) {
    const start = ((module.y * PIXELS_PER_MODULE + row) * width + module.x * PIXELS_PER_MODULE) * RGBA;
    for (let offset = 0; offset < PIXELS_PER_MODULE * RGBA; offset += RGBA) {
      pixels.set([0, 0, 0], start + offset);
    }
  }
}
