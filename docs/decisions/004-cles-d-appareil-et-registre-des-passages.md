# 004 — Clés d'appareil hachées et passage enregistré en une seule instruction

**Contexte.** Les contrôleurs de barrière (et la console de démonstration qui
les joue) s'authentifient par une clé d'appareil (`docs/04`) ; le dossier ne dit
ni comment la stocker ni comment la révoquer. Chaque boucle fermée doit à la
fois laisser une trace du passage et changer le compteur du parking, sans
jamais descendre sous zéro (D6), même avec des passages simultanés.

**Décision.**
- Les clés vivent dans `gate_device_key(gate_id, key_hash UNIQUE, created_at, revoked_at)`,
  séparée de `gate` : une barrière peut changer de clé et garder l'historique
  des clés révoquées. Seule l'empreinte SHA-256 est stockée ; une clé fait
  32 octets aléatoires, donc un hachage rapide sans sel suffit et permet la
  recherche directe par empreinte (pas de comparaison à temps constant à faire).
- Un crochet Fastify `onRequest` authentifie toutes les routes `/v1/gates/*`
  avant la validation du corps ; toute clé refusée reçoit la même réponse 401.
- Le port `PassageLedger` enregistre le passage et ajuste le compteur dans une
  seule instruction SQL : `WITH inserted AS (INSERT INTO gate_passage …) UPDATE parking_lot
  SET vehicle_count = GREATEST(vehicle_count + Δ, 0) … RETURNING vehicle_count`.
- `gate_passage(gate_id, lot_id)` référence `gate(id, lot_id)` par clé
  étrangère composée, comme pour les places (003).

**Conséquences.** Le passage et le compteur réussissent ou échouent ensemble ;
les entrées simultanées sont sérialisées par le verrou de ligne de
`parking_lot` (vérifié par `test:db`). Une clé perdue ne se récupère pas : on
en crée une nouvelle et on révoque l'ancienne. Le compteur peut dépasser la
capacité (passages d'abonnés inconnus de Palier, Q35) ; l'affichage plafonne
les places libres à `min(capacité − véhicules, places libres)`, jamais négatif.
#12 ajoutera une clé d'idempotence à `gate_passage` pour la relecture hors ligne.
