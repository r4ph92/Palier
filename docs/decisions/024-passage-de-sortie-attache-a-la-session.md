# 024 — Passage de sortie attaché à la session

**Contexte.** #47 ferme la session `CLOSED_PAID` et commande l'ouverture de la sortie, sans toucher au compteur (023). #48 : la boucle de sortie qui se ferme enregistre la sortie réelle.

**Décision.**
- Le passage sur une barrière `EXIT` fait ce qu'il faisait déjà (ligne `gate_passage`, compteur − 1, jamais sous 0, D6), puis pose `parking_session.exit_passage_at` (migration 0022, nullable) à `closedAt`.
- **Appariement** : la plus ancienne commande `OPEN` de cette barrière, dont la session est `CLOSED_PAID` sans `exit_passage_at`, émise dans la fenêtre d'ouverture (60 s, `ENTRY_CONFIRMATION_WINDOW_SECONDS`, mesurée sur l'horloge de Postgres), comme l'entrée (`confirmOldestOpening`). Même transaction et même verrou du parking que le compteur.
- **Sans ouverture en attente ou hors fenêtre** : le compteur baisse, aucune session ne change ; la session reste `CLOSED_PAID` sans `exit_passage_at`. Aucune annulation ni nouvelle capture.
- La réponse du passage gagne `exitedSessionId` (`null` à une entrée ou sans appariement).
- `exit_at` (le geste, #47) et `exit_passage_at` (la boucle) restent distincts ; le reçu garde `exit_at`.

**Conséquences.** Un seul passage par ouverture ; un second passage sans nouvelle ouverture ne change que le compteur. L'écart entre compteur et sessions reste visible par #71.
