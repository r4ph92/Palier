import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('the app in any build', () => {
  it('has no way to reach the test clock or backdate a session', () => {
    const offending = sourceFiles(join(__dirname, '..', 'src')).filter((path) => /\/v1\/test\/(clock|sessions)/.test(readFileSync(path, 'utf8')));

    expect(offending).toEqual([]);
  });
});
