# 002 — La porte ne contient que des tests unitaires

**Contexte.** Le projet veut une porte (`npm run gate`) rapide à chaque story. Les tests sur base de données et les parcours en simulateur sont lents et fragiles.

**Décision.** `npm run gate` et la CI exécutent lint, typecheck et tests unitaires seulement : l'API avec des dépôts en mémoire, l'app avec un faux client. Les vérifications Postgres vivent dans `npm run test:db`, optionnel et hors CI. Les critères d'acceptation sont prouvés en pilotant l'app dans le simulateur, sans suite e2e.

**Conséquences.** Le filtre `is_online` et le comptage `AVAILABLE` ne sont gardés que par `test:db` et la QA manuelle. Aucun outil e2e (Maestro, Playwright) n'est installé.
