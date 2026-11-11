# 029 — Rejeu des passages comptés hors ligne

**Contexte.** Q47 : un contrôleur hors ligne refuse l'entrée aux usagers Palier, ouvre la sortie sans condition et compte localement. À la reconnexion, le compteur du parking doit redevenir juste (#12).

**Décision.**
- **Route** : `POST /v1/gates/:id/passages/replay`, clé d'appareil comme seul justificatif (EXEMPT dans `routeClassification.ts`). Corps `{ passages: [{ id, kind, closedAt }] }`, de 1 à 500 éléments ; réponse `{ counted, duplicates, vehicleCount }`.
- **Idempotence** : l'`id` est un uuid choisi par la console à chaque appui. Migration 0029 : `gate_passage.replay_id` nullable et index unique `(gate_id, replay_id)` (les passages simples le laissent à `null`). `insert … on conflict do nothing`, puis le compteur bouge de `delta × lignes réellement insérées`, sous le verrou du parking, dans une seule transaction. Un lot entièrement connu répond 200 avec `counted: 0`. Le garant réel est l'index unique ; le test unitaire ne couvre que la fausse implémentation (`test:db` est hors du gate, décision 002), la preuve sur Postgres a été faite à la main sur `palier_12`.
- **Compte seulement** : un rejeu ne confirme aucune session et n'attache aucune sortie. Les sorties d'une panne ne sont pas rattachées aux sessions, qui remontent après 7 jours (#74) ; refuser les scans Palier à une barrière muette est #76.
- **Validation avant écriture** : la barrière de la clé doit être celle de l'URL (403), avoir des boucles (409) ; chaque élément doit être du sens de la barrière (409 `REPLAY_KIND_MISMATCH`), les ids distincts (400 `REPLAY_IDS_REPEATED`), `closedAt` valide, pas à plus de 5 minutes dans le futur ni de plus de 7 jours dans le passé (400 `CLOSED_AT_TOO_OLD`). La borne de 7 jours ne vaut que pour le rejeu ; la route d'un passage seul est inchangée. Les règles communes sont dans `passageRules.ts`.
- **Console** : la file est liée à la clé et à la barrière ; la clé est verrouillée tant que la console est hors ligne. Seuls les lots confirmés par un 200 sortent de la file. Seuls un Palier injoignable et une erreur 5xx se réessaient ; sur 400, 401, 403 ou 409, « Vider la file » abandonne la file.
- **Limitation de débit** : non faite pour les routes de barrière, reportée ; la clé d'appareil et le plafond de 500 éléments bornent l'abus d'ici là.

**Conséquences.** Le compteur reste borné à 0 (D6, Q35) : un rejeu qui descendrait plus bas masque l'écart. Un rejeu envoyé deux fois, ou en deux lots qui se recoupent, ne change le compteur qu'une fois.
