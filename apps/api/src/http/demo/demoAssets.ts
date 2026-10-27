export interface DemoAsset {
  readonly contentType: string;
  readonly location: URL;
}

const CONSOLE_PAGE = 'console.html';
const JAVASCRIPT = 'text/javascript; charset=utf-8';

function besideThisFile(fileName: string): URL {
  return new URL(fileName, import.meta.url);
}

export const DEMO_ASSETS: Readonly<Record<string, DemoAsset>> = {
  [CONSOLE_PAGE]: { contentType: 'text/html; charset=utf-8', location: besideThisFile(CONSOLE_PAGE) },
  'console.css': { contentType: 'text/css; charset=utf-8', location: besideThisFile('console.css') },
  'console.js': { contentType: JAVASCRIPT, location: besideThisFile('console.js') },
  'consoleText.js': { contentType: JAVASCRIPT, location: besideThisFile('consoleText.js') },
  'consoleTranslations.js': { contentType: JAVASCRIPT, location: besideThisFile('consoleTranslations.js') },
  'gateApi.js': { contentType: JAVASCRIPT, location: besideThisFile('gateApi.js') },
  'loopPress.js': { contentType: JAVASCRIPT, location: besideThisFile('loopPress.js') },
};

export function demoAssetUrl(fileName: string): string {
  return fileName === CONSOLE_PAGE ? '/demo/console' : `/demo/${fileName}`;
}
