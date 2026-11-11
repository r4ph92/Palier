# 028 — Sortie par lecteur de plaque ou de transpondeur

**Contexte.** #52 (Q34, étape 1) : quand l'opérateur a un lecteur à la sortie, la barrière s'ouvre sans geste du conducteur, même téléphone éteint. Le lecteur reste une option de l'opérateur, jamais une condition : sans lecteur, le conducteur garde le geste « Ouvrir » (023).

**Décision.**
- **Route** : `POST /v1/gates/:id/identify`, corps `{ identifier }`, clé d'appareil de la barrière (comme `/passage`). 200 `{ outcome: 'opened', identification: 'plate' | 'transponder' }` ou `{ outcome: 'fallback', identification: null }`.
- **Lecteur de la barrière** : `gate.exit_id_kind` (`ANPR` lit une plaque, `RFID` un transpondeur, `NONE` rien). Une barrière `NONE`, ou d'entrée, répond 409 `GATE_WITHOUT_READER` sans rien chercher. Une clé qui n'est pas celle de `:id` répond 403 `GATE_FORBIDDEN`, une clé inconnue ou révoquée 401. Sortie Démo est semée `ANPR` ; pour la démo transpondeur : `update gate set exit_id_kind = 'RFID' where name = 'Sortie Démo'`. Aucune route ne change cette valeur (l'écran opérateur est #74/#75).
- **Normalisation** : la même que la plaque (`readPlate`) : casse, espaces et traits d'union ignorés, 8 caractères au plus, lettres, chiffres, espaces et traits d'union seulement. « abc123 » = « ABC 123 », « t0042 » = « T-0042 ». Un identifiant illisible répond 400 `IDENTIFIER_INVALID`, sans rien chercher.
- **Recherche** : les sessions du parking de la barrière qui n'ont pas quitté (entrée confirmée ou garé), par la plaque de la session ou par le transpondeur du véhicule (`vehicle.transponder_key`, ajouté à `PATCH /v1/me/vehicles/:id`, facultatif, effacé par une valeur vide ; **unique** entre tous les véhicules, index `vehicle_transponder_key_unique`, migration 0028 : un transpondeur déjà pris répond 409 `TRANSPONDER_ALREADY_REGISTERED`, que l'app lit « Ce transpondeur est déjà enregistré. »). Une barrière de plaque ne lit que les plaques, une barrière de transpondeur que les transpondeurs. Au plus deux sessions sont lues : zéro ou deux veulent dire « repli », rien n'est capturé ni ouvert. Une session déjà fermée n'est jamais trouvée : relire la même plaque ne capture pas une seconde fois.
- **Sortie** : exactement le chemin de 023 et 026 (`payAndClose`) : capture sur l'autorisation d'entrée, session fermée, places libérées, commande `OPEN` pour la barrière qui a lu, reçu dans l'historique (025). Seule l'identification change : `exit_identification` vaut `PLATE` ou `TRANSPONDER` (migration 0027). Si Stripe est injoignable, la barrière s'ouvre quand même et la capture est rejouée (026).
- **Horloge** : celle du geste (l'horloge de test quand elle est active), pour que le prix et l'heure de sortie soient ceux du geste.
- **Console de démo** : champ « Plaque lue » et bouton, message « Aucune session — repli sur l'app » pour un repli.

**Conséquences.** Limites connues :
- Deux sessions sur la même plaque (deux comptes) ne sortent jamais par lecteur : le conducteur touche « Ouvrir ».
- Le transpondeur est unique, la plaque non (deux comptes peuvent avoir la même, c'est le repli qui protège). Le 409 révèle qu'un transpondeur est déjà pris, et quelqu'un peut occuper à l'avance celui d'un autre : le conducteur floué garde le geste « Ouvrir » et n'est jamais facturé à tort.
- Un transpondeur modifié pendant un stationnement s'applique tout de suite à la session ouverte (il est lu sur le véhicule, pas copié à l'entrée).
- Une lecture fausse (plaque lue d'une autre voiture inscrite) ouvre pour la session qui porte cette plaque : le lecteur est de confiance, comme la clé d'appareil.
- Un repli ne laisse aucune trace côté serveur (pas de table de lectures).
- Une session en capture en attente (026) n'est pas retrouvée : elle est déjà sortie.
