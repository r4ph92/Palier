# 046 — Lint typé dans tout le dépôt

**Contexte.** #81 : les promesses non attendues et les `switch` non exhaustifs passaient le lint (règles sans information de type). #4 l'avait reporté.

**Décision.**
- `eslint.config.mjs` active `parserOptions.projectService` pour `**/*.{ts,tsx,js}`, y compris les tests et les fichiers JS de la console de démo, avec `@typescript-eslint/no-floating-promises` et `@typescript-eslint/switch-exhaustiveness-check` en erreur (option par défaut : un `default` ne rend pas un `switch` exhaustif).
- Les `switch` trop longs pour la limite de complexité deviennent des tables (`PAGES` du tableau de bord).
- `apps/mobile/tsconfig.json` étend `expo/tsconfig.base` puis `tsconfig.base.json`.
- `typedLintRules.test.ts` vérifie la configuration appliquée à un fichier par espace de travail.

**Conséquences.** Le lint passe d'environ 8 s à 15 s sur une machine calme (construction des programmes TypeScript) ; il ralentit davantage sous charge.
