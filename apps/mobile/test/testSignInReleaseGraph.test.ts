import { overlaid, releaseGraph, type ReadSource, type ReleaseGraph } from './releaseGraph';

const TEST_SIGN_IN_FOLDER = 'apps/mobile/src/testSignIn/';
const LOADER = `${TEST_SIGN_IN_FOLDER}loadTestSignIn.ts`;
const SIGN_IN_SCREEN = 'apps/mobile/src/screens/SignInScreen.tsx';
const APP_ENTRY = 'apps/mobile/src/App.tsx';
const SHARED_MONEY = 'packages/shared-types/src/money.ts';
// What the README tells a developer to grep for in an export.
const RELEASE_FORBIDDEN = ['Connexion de test', 'Test sign-in', '/v1/test/'];

function testSignInFilesIn(graph: ReleaseGraph): string[] {
  return graph.files
    .filter(({ path }) => path.startsWith(TEST_SIGN_IN_FOLDER))
    .map(({ path }) => path.slice(TEST_SIGN_IN_FOLDER.length))
    .sort();
}

function forbiddenTextIn(graph: ReleaseGraph): string[] {
  return graph.files.flatMap(({ path, text }) => RELEASE_FORBIDDEN.filter((needle) => text.includes(needle)).map((needle) => `${path}: ${needle}`));
}

function withLine(path: string, line: string): ReadSource {
  return overlaid({ [path]: (text) => `${text}\n${line}\n` });
}

describe('what a release bundle holds of test sign-in', () => {
  it('follows every module of the app from its entry', () => {
    const graph = releaseGraph();
    const paths = graph.files.map(({ path }) => path);

    expect(graph.unfollowed).toEqual([]);
    expect(paths).toEqual(expect.arrayContaining(['apps/mobile/index.ts', APP_ENTRY, SIGN_IN_SCREEN, LOADER, SHARED_MONEY]));
  });

  it('takes the loader from the test sign-in folder, and nothing else', () => {
    expect(testSignInFilesIn(releaseGraph())).toEqual(['loadTestSignIn.ts']);
  });

  it('carries no test sign-in label or /v1/test/ route in any module, shared types included', () => {
    expect(forbiddenTextIn(releaseGraph())).toEqual([]);
  });
});

// Each form below passes lint and the type check, yet a real export bundled the section (#98).
describe('a change that puts test sign-in back in a release bundle', () => {
  it.each([
    { change: 'a value import in double quotes', path: SIGN_IN_SCREEN, line: `import { TestSignInSection } from "../testSignIn/TestSignInSection";`, bundled: 'TestSignInSection.tsx' },
    { change: 'a require behind the flag alone', path: APP_ENTRY, line: `export const leak = process.env.EXPO_PUBLIC_TEST_SIGN_IN === 'true' ? require('./testSignIn/testSignInModule') : null;`, bundled: 'testSignInModule.ts' },
    { change: 'a require named by a template literal', path: APP_ENTRY, line: 'export const leak = require(`./testSignIn/testSignInModule`);', bundled: 'testSignInModule.ts' },
    { change: 'a require under a type assertion, which no lint rule sees', path: APP_ENTRY, line: `export const leak: unknown = (require as NodeJS.Require)('./testSignIn/testSignInModule');`, bundled: 'testSignInModule.ts' },
    { change: 'a module name under a type assertion', path: APP_ENTRY, line: `export const leak: unknown = require('./testSignIn/testSignInModule' as string);`, bundled: 'testSignInModule.ts' },
    { change: 'a dynamic import', path: SIGN_IN_SCREEN, line: `export const preload = () => import('../testSignIn/TestSignInSection');`, bundled: 'TestSignInSection.tsx' },
    { change: 'a re-export', path: 'apps/mobile/src/api/HttpAuthClient.ts', line: `export { HttpTestSignInClient } from '../testSignIn/HttpTestSignInClient';`, bundled: 'HttpTestSignInClient.ts' },
    { change: 'an import for its side effects', path: SIGN_IN_SCREEN, line: `import '../testSignIn/testSignInModule';`, bundled: 'testSignInModule.ts' },
    { change: 'a re-export from the loader itself', path: LOADER, line: `export { testSignInText } from './testSignInText';`, bundled: 'testSignInText.ts' },
    { change: 'a ternary that loads in release instead', path: APP_ENTRY, line: `export const leak = __DEV__ ? null : require('./testSignIn/testSignInModule');`, bundled: 'testSignInModule.ts' },
    { change: 'a ternary on a __DEV__ the module declares itself', path: APP_ENTRY, line: `const __DEV__ = true;\nexport const leak = __DEV__ ? require('./testSignIn/testSignInModule') : null;`, bundled: 'testSignInModule.ts' },
  ])('is caught: $change', ({ path, line, bundled }) => {
    expect(testSignInFilesIn(releaseGraph(withLine(path, line)))).toContain(bundled);
  });

  it.each([
    { change: 'a folder loaded whole', call: `require.context('./testSignIn')` },
    { change: 'a module name joined from two strings', call: `require('./testSignIn/' + 'testSignInModule')` },
    { change: 'a module name held in a constant', call: `(require as NodeJS.Require)(TEST_SIGN_IN_MODULE)` },
  ])('is caught as a load this walk cannot follow: $change', ({ call }) => {
    const unnamed = withLine(APP_ENTRY, `const TEST_SIGN_IN_MODULE = './testSignIn/testSignInModule';\nexport const leak: unknown = ${call};`);

    expect(releaseGraph(unnamed).unfollowed).toContain(`${APP_ENTRY}: ${call}`);
  });

  it('is caught as a load this walk cannot follow: a workspace package it does not know', () => {
    const packaged = withLine(APP_ENTRY, `import '@palier/test-sign-in';`);

    expect(releaseGraph(packaged).unfollowed).toContain(`${APP_ENTRY} -> @palier/test-sign-in`);
  });

  it('is caught: the loader without its __DEV__ ternary', () => {
    const always = overlaid({ [LOADER]: (text) => text.replace('__DEV__ ?', 'true ?') });

    expect(testSignInFilesIn(releaseGraph(always))).toContain('TestSignInSection.tsx');
    expect(forbiddenTextIn(releaseGraph(always))).not.toEqual([]);
  });

  it('is caught: a test route written in the shared types', () => {
    const shared = withLine(SHARED_MONEY, `export const TEST_SIGN_IN_PATH = '/v1/test/sign-in';`);

    expect(forbiddenTextIn(releaseGraph(shared))).toContain(`${SHARED_MONEY}: /v1/test/`);
  });
});

describe('a change that leaves test sign-in out of a release bundle', () => {
  it.each([
    ['a type import', `import type { TestSignInSectionProps } from '../testSignIn/TestSignInSection';\nexport type Leak = TestSignInSectionProps;`],
    ['an import of names all marked type', `import { type TestSignInSectionProps } from '../testSignIn/TestSignInSection';\nexport type Leak = TestSignInSectionProps;`],
    ['a type query', `export type Leak = typeof import('../testSignIn/TestSignInSection');`],
    ['a second require behind a literal __DEV__ ternary', `export const leak = __DEV__ ? require('../testSignIn/testSignInModule') : null;`],
  ])('is accepted: %s', (_change, line) => {
    expect(testSignInFilesIn(releaseGraph(withLine(SIGN_IN_SCREEN, line)))).toEqual(testSignInFilesIn(releaseGraph()));
  });

  // Metro folds this constant too and a real export stays clean; the walk still asks for the one ternary decision 008 names.
  it('is refused all the same: the development flag read through a constant', () => {
    const aliased = withLine(APP_ENTRY, `const isDevelopment = __DEV__;\nexport const leak = isDevelopment ? require('./testSignIn/testSignInModule') : null;`);

    expect(testSignInFilesIn(releaseGraph(aliased))).toContain('testSignInModule.ts');
  });
});
