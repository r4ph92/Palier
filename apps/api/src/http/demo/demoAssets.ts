import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export interface DemoAsset {
  readonly contentType: string;
  readonly location: URL;
}

const CONSOLE_PAGE = 'console.html';
const JAVASCRIPT = 'text/javascript; charset=utf-8';
const FONT = 'font/ttf';
const resolvePackageFile = createRequire(import.meta.url).resolve;

function besideThisFile(fileName: string): URL {
  return new URL(fileName, import.meta.url);
}

function fromPackage(specifier: string): URL {
  return pathToFileURL(resolvePackageFile(specifier));
}

export const DEMO_ASSETS: Readonly<Record<string, DemoAsset>> = {
  [CONSOLE_PAGE]: { contentType: 'text/html; charset=utf-8', location: besideThisFile(CONSOLE_PAGE) },
  'console.css': { contentType: 'text/css; charset=utf-8', location: besideThisFile('console.css') },
  'console.js': { contentType: JAVASCRIPT, location: besideThisFile('console.js') },
  'consoleText.js': { contentType: JAVASCRIPT, location: besideThisFile('consoleText.js') },
  'consoleTranslations.js': { contentType: JAVASCRIPT, location: besideThisFile('consoleTranslations.js') },
  'gateApi.js': { contentType: JAVASCRIPT, location: besideThisFile('gateApi.js') },
  'loopPress.js': { contentType: JAVASCRIPT, location: besideThisFile('loopPress.js') },
  'Archivo_400Regular.ttf': {
    contentType: FONT,
    location: fromPackage('@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf'),
  },
  'Archivo_600SemiBold.ttf': {
    contentType: FONT,
    location: fromPackage('@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf'),
  },
  'IBMPlexMono_400Regular.ttf': {
    contentType: FONT,
    location: fromPackage('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'),
  },
  'IBMPlexMono_500Medium.ttf': {
    contentType: FONT,
    location: fromPackage('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf'),
  },
};

export function demoAssetUrl(fileName: string): string {
  return fileName === CONSOLE_PAGE ? '/demo/console' : `/demo/${fileName}`;
}
