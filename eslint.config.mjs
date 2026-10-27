import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', 'apps/mobile/ios/**', 'apps/mobile/android/**', 'docs/**', 'tools/**', 'remise/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'max-lines-per-function': ['error', { max: 20, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 3],
      'max-depth': ['error', 2],
      complexity: ['error', 10],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['**/test/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: { 'max-lines-per-function': 'off' },
  },
);
