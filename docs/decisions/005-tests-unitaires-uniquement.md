# 005 - Tests unitaires uniquement

**Contexte.** La porte ne contenait déjà que des tests unitaires (002), mais la suite `test:db` restait dans le dépôt, demandait Docker et une base `palier_test`, et personne ne la lançait.

**Décision.** La suite `test:db` est supprimée : ses trois fichiers `apps/api/test/database/`, sa configuration `vitest.database.config.ts` et les scripts `test:db` des deux `package.json`. Le projet ne garde que des tests unitaires, Vitest pour l'API avec des dépôts en mémoire et Jest pour l'app avec un faux client. Aucun test de base de données, d'intégration ou de navigateur n'est ajouté par la suite.

**Conséquences.** Le filtre `is_online`, le comptage `AVAILABLE` et l'appartenance d'une place à son parking (003) ne sont plus couverts par un test automatisé : ils reposent sur les contraintes de la base et sur la QA manuelle. Remplace la partie `test:db` de 002 et de 003.
