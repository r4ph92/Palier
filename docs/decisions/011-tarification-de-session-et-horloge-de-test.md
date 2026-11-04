# 011 — Tarification figée à l'entrée et horloge de test

**Contexte.** #38 affiche le montant à ce jour (D1 : prix par tranche commencée, durée de tranche, plafond journalier obligatoire). Le dossier ne dit ni quand la facturation commence, ni comment arrondir, ni comment un testeur vérifie « à 21 h 17 » sans attendre.

**Décision.**
- **Tarif figé** (D1) : `parking_session` garde `pricing_increment_cents`, `pricing_increment_minutes` et `pricing_daily_cap_cents` (entiers, non nuls, `CHECK > 0`), copiés à l'entrée depuis `parking_lot.pricing_policy` et `daily_cap_cents`. Un parking sans tarif lisible refuse l'entrée en `LOT_NOT_IN_SERVICE`, avec un avertissement au journal.
- **Départ de la facturation** : `entry_scan_at`, le scan à la borne, comme la pré-autorisation ; « Entrée 18 h 02 » affiche la même heure. `entry_confirmed_at` (la boucle) reste informatif.
- **Arrondi** (`domain/pricing/priceParkingSessionAt`) : minutes écoulées = `max(0, floor(ms / 60 000))` ; montant = `min(plafond, max(1, ceil(minutes / durée)) × prix)`. La première tranche commence à l'entrée : 3 h 15 → 9,75 $, 3 h 16 → 10,50 $, 10 h → 25,00 $. Au-delà de 24 h, le plafond reste celui d'une journée jusqu'à #51.
- **Migration 0011** : les sessions existantes reçoivent le tarif de leur parking ; une valeur absente ou qui n'est pas un entier positif prend 75 ¢ par 15 minutes, et le plafond vient de `daily_cap_cents`.
- **Horloge de test** : `GET`, `PUT` et `DELETE /v1/test/clock` et `PUT /v1/test/sessions/:sessionId/entered-at` n'existent qu'avec la connexion de test (`NODE_ENV` à `development` ou `test`) et seulement si `createClock` a fourni une horloge de test ; ailleurs, 404. Seul `GET /v1/me/session` lit cette horloge : les barrières et `now()` de Postgres restent à l'heure réelle. Ces routes ne demandent aucun jeton, comme la connexion de test. Reculer une session déplace `entry_confirmed_at` du même écart et refuse une heure postérieure à l'horloge ; une session annulée répond 404.

**Conséquences.** L'app n'a aucun contrôle d'horloge et ne compte pas le temps elle-même : elle relit la session chaque minute. Le SQL de la lecture et du recul n'est vérifié que sur la base de la voie (décisions 002 et 005).
