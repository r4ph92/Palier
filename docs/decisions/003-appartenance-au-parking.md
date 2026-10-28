# 003 — L'appartenance d'une place à son parking est garantie par la base

**Contexte.** `docs/02` dit que `spot.number` est unique dans le parking, mais `spot` ne porte que `aisle_id`. Une contrainte applicative seule laisserait deux sources de vérité (le chemin place → allée → palier → parking, et une colonne copiée).

**Décision.** `aisle.lot_id` et `spot.lot_id` sont dénormalisés et liés par clés étrangères composées : `(level_id, lot_id) → level(id, lot_id)` et `(aisle_id, lot_id) → aisle(id, lot_id)`. `UNIQUE (lot_id, number)` devient une vraie contrainte. La requête d'occupation joint `spot.lot_id` directement.

**Conséquences.** Une place ne peut pas pointer vers l'allée d'un autre parking (vérifié par `test:db`). Les scripts de seed et les futures écritures doivent renseigner `lot_id` de façon cohérente ; la base refuse le reste.
