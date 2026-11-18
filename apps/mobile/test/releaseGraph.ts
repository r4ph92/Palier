import { readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import * as ts from 'typescript';

const MOBILE_ROOT = join(__dirname, '..');
const REPOSITORY_ROOT = join(MOBILE_ROOT, '..', '..');
const OWN_SCOPE = '@palier/';
const SHARED_TYPES = `${OWN_SCOPE}shared-types`;
const SHARED_TYPES_ROOT = join(REPOSITORY_ROOT, 'packages', 'shared-types');
// The order Metro tries for an iOS bundle; the empty suffix serves a specifier that already names its file.
const SUFFIXES = ['', '.ios.ts', '.ios.tsx', '.native.ts', '.native.tsx', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx'];
const SCRIPT = /\.[jt]sx?$/;
const DEVELOPMENT_FLAG = '__DEV__';

export type ReadSource = (path: string) => string | undefined;

interface SharedTypesManifest {
  readonly exports: Record<string, { readonly default: string }>;
}

export interface BundledFile {
  readonly path: string;
  readonly text: string;
}

export interface ReleaseGraph {
  readonly files: readonly BundledFile[];
  // What the walk could not follow; anything here means the graph may miss a module.
  readonly unfollowed: readonly string[];
}

function readFromDisk(path: string): string | undefined {
  return statSync(path, { throwIfNoEntry: false })?.isFile() === true ? readFileSync(path, 'utf8') : undefined;
}

// Reads the repository with some files replaced, to try a change without writing it. Keys are paths from the repository root.
export function overlaid(changes: Readonly<Record<string, (text: string) => string>>): ReadSource {
  return (path) => {
    const text = readFromDisk(path);
    const change = changes[relative(REPOSITORY_ROOT, path)];
    return text === undefined || change === undefined ? text : change(text);
  };
}

// The modules a release bundle holds: everything the entry reaches at run time once Metro has folded `__DEV__` to false.
export function releaseGraph(read: ReadSource = readFromDisk): ReleaseGraph {
  const { main } = JSON.parse(readFileSync(join(MOBILE_ROOT, 'package.json'), 'utf8')) as { readonly main: string };
  const texts = new Map<string, string>();
  const unfollowed: string[] = [];
  const queue = [join(MOBILE_ROOT, main)];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    const text = texts.has(path) ? undefined : read(path);
    if (text !== undefined) {
      texts.set(path, text);
      queue.push(...followed({ path, text }, read, unfollowed));
    }
  }
  return { files: [...texts].map(([path, text]) => ({ path: relative(REPOSITORY_ROOT, path), text })), unfollowed };
}

function followed(file: BundledFile, read: ReadSource, unfollowed: string[]): string[] {
  if (!SCRIPT.test(file.path)) {
    return [];
  }
  return runtimeSpecifiers(file, unfollowed).flatMap((specifier) => {
    const target = resolveSpecifier(file.path, specifier, read);
    if (target === undefined && isOwnCode(specifier)) {
      unfollowed.push(`${relative(REPOSITORY_ROOT, file.path)} -> ${specifier}`);
    }
    return target === undefined ? [] : [target];
  });
}

function isOwnCode(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith(OWN_SCOPE);
}

function resolveSpecifier(from: string, specifier: string, read: ReadSource): string | undefined {
  const base = specifier.startsWith('.') ? resolve(dirname(from), specifier) : sharedTypesModule(specifier);
  return base === undefined ? undefined : SUFFIXES.map((suffix) => `${base}${suffix}`).find((candidate) => read(candidate) !== undefined);
}

function sharedTypesModule(specifier: string): string | undefined {
  if (!specifier.startsWith(SHARED_TYPES)) {
    return undefined;
  }
  const manifest = JSON.parse(readFileSync(join(SHARED_TYPES_ROOT, 'package.json'), 'utf8')) as SharedTypesManifest;
  const target = manifest.exports[`.${specifier.slice(SHARED_TYPES.length)}`]?.default;
  return target === undefined ? undefined : join(SHARED_TYPES_ROOT, target);
}

function runtimeSpecifiers({ path, text }: BundledFile, unfollowed: string[]): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const children = declaresDevelopmentFlag(source) ? childrenOf : bundledChildren;
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    const named = moduleNamedBy(node);
    const specifier = literalText(named);
    if (specifier !== undefined) {
      specifiers.push(specifier);
    } else if (named !== undefined || isRequireContext(node)) {
      // Metro evaluates the name of a module itself (two strings joined, a constant); the walk does not, and says so.
      unfollowed.push(`${relative(REPOSITORY_ROOT, path)}: ${node.getText()}`);
    }
    children(node).forEach(visit);
  };
  visit(source);
  return specifiers;
}

// Metro replaces the global `__DEV__` by false and folds the ternary; any other spelling stays unfolded here and counts as bundled.
function bundledChildren(node: ts.Node): ts.Node[] {
  const isFolded = ts.isConditionalExpression(node) && ts.isIdentifier(node.condition) && node.condition.text === DEVELOPMENT_FLAG;
  return isFolded ? [node.whenFalse] : childrenOf(node);
}

function childrenOf(node: ts.Node): ts.Node[] {
  const children: ts.Node[] = [];
  ts.forEachChild(node, (child) => {
    children.push(child);
  });
  return children;
}

// A module that declares a `__DEV__` of its own hides the global: Metro leaves that one alone, and the require stays in the bundle.
function declaresDevelopmentFlag(node: ts.Node): boolean {
  const isDeclared = ts.isIdentifier(node) && node.text === DEVELOPMENT_FLAG && ts.getNameOfDeclaration(node.parent as ts.Declaration) === node;
  return isDeclared || ts.forEachChild(node, declaresDevelopmentFlag) === true;
}

type ModuleReference = (node: ts.Node) => ts.Node | undefined;

const MODULE_REFERENCES: readonly ModuleReference[] = [importedModule, reExportedModule, importEqualsModule, loadedModule];

function moduleNamedBy(node: ts.Node): ts.Node | undefined {
  return MODULE_REFERENCES.map((reference) => reference(node)).find((found) => found !== undefined);
}

function importedModule(node: ts.Node): ts.Node | undefined {
  return ts.isImportDeclaration(node) && !isErasedImport(node.importClause) ? node.moduleSpecifier : undefined;
}

// Babel drops `import type` and an import whose every name is marked `type`; an import of values or for side effects stays.
function isErasedImport(clause: ts.ImportClause | undefined): boolean {
  if (clause === undefined) {
    return false;
  }
  if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) {
    return true;
  }
  const names = clause.namedBindings;
  return clause.name === undefined && names !== undefined && ts.isNamedImports(names) && areAllTypes(names.elements);
}

function reExportedModule(node: ts.Node): ts.Node | undefined {
  if (!ts.isExportDeclaration(node) || node.isTypeOnly) {
    return undefined;
  }
  const names = node.exportClause;
  return names !== undefined && ts.isNamedExports(names) && areAllTypes(names.elements) ? undefined : node.moduleSpecifier;
}

function areAllTypes(elements: readonly { readonly isTypeOnly: boolean }[]): boolean {
  return elements.length > 0 && elements.every((element) => element.isTypeOnly);
}

function importEqualsModule(node: ts.Node): ts.Node | undefined {
  const isRuntime = ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference);
  return isRuntime ? node.moduleReference.expression : undefined;
}

// Left out on purpose: `require.resolveWeak` bundles nothing, and Metro's worker forms only run in a web build.
const LOADERS: ReadonlySet<string> = new Set(['require', 'import', '__prefetchImport', 'require.unstable_importMaybeSync']);

function loadedModule(node: ts.Node): ts.Node | undefined {
  return ts.isCallExpression(node) && LOADERS.has(withoutTypeSyntax(node.expression).getText()) ? node.arguments[0] : undefined;
}

const TYPE_SYNTAX: readonly ((node: ts.Node) => node is ts.Node & { readonly expression: ts.Expression })[] = [
  ts.isParenthesizedExpression,
  ts.isAsExpression,
  ts.isNonNullExpression,
  ts.isSatisfiesExpression,
  ts.isTypeAssertionExpression,
];

// Babel strips parentheses and type syntax before Metro reads the call: `(require as NodeJS.Require)('…')` loads like `require('…')`.
function withoutTypeSyntax(node: ts.Node): ts.Node {
  for (const isWrapper of TYPE_SYNTAX) {
    if (isWrapper(node)) {
      return withoutTypeSyntax(node.expression);
    }
  }
  return node;
}

function isRequireContext(node: ts.Node): boolean {
  return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.getText() === 'require.context';
}

function literalText(node: ts.Node | undefined): string | undefined {
  const bare = node === undefined ? undefined : withoutTypeSyntax(node);
  return bare !== undefined && (ts.isStringLiteral(bare) || ts.isNoSubstitutionTemplateLiteral(bare)) ? bare.text : undefined;
}
