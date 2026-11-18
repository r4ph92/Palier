# 020 — Question « Où êtes-vous garé ? » après un passage à pied dans une autre allée

**Contexte.** #21 : le signal *walking* arrive dans une autre allée que celle de la place assignée (docs/03, séquence B). Le « D9 » de la story n'existe pas dans les documents ; cette décision le remplace pour la place déjà attribuée.

**Décision.**
- **États et colonnes** (migration 0017, enum recréé comme 0016) : `PARKED_UNCONFIRMED` (question posée) et `PARKED_CONFIRMED` (réponse reçue) sont actifs ; `parked_aisle_id` (allée vue au passage à pied), `confirmed_spot_id` (place réelle, index unique partiel sur les états actifs) et `parked_answered_at` (et non `confirmed_at` de docs/02), avec clés composées vers le même parking et deux CHECK qui comparent `state::text`, pour qu'une prochaine recréation de l'enum reste possible.
- **Passage à pied** : `POST /v1/entries/:sessionId/parked` reçoit `detectedAisleMinor` (0 à 65 535, facultatif ; l'app l'envoie dès qu'elle connaît l'allée). L'allée est cherchée par minor dans tout le parking, voies de sortie exclues ; inconnue ou égale à celle de la place, le passage présume la place comme en 019. Sinon, sous le verrou du parking : session `PARKED_UNCONFIRMED`, puis place assignée `OCCUPIED_UNKNOWN` et `needs_check` dans la même transaction. La réponse porte l'état (`PARKED_PRESUMED`, `PARKED_UNCONFIRMED` ou, pour un signal répété, `PARKED_CONFIRMED`) ; 503 `LOT_BUSY` après 3 s d'attente du verrou.
- **Réponse** : `POST /v1/entries/:sessionId/spot` `{ spotNumber }` (et non `{ spot_id }` de docs/03), 1 à 16 caractères sans caractère de contrôle. Le numéro peint tel quel l'emporte ; sinon il est comparé sans casse, espaces ni tirets (`canonicalSpotNumber` : « b3 », « B – 3 » → « B-3 », « p112 » → « P1-12 »), et « B-03 » reste inconnu. Sans numéro exact, un numéro qui en désigne plusieurs (« b12 » à côté de « B12 » et « B1-2 ») répond `UNKNOWN_SPOT` sans rien changer ; la recherche passe par l'index `spot_lot_id_canonical_number_index` (migration 0018). Verrous parking → session → place ; l'issue se décide sur l'état de la place lu sous verrou : `AVAILABLE` ou `OCCUPIED_UNKNOWN` (la place assignée elle-même, ou celle d'un conducteur parti à pied ailleurs) → `OCCUPIED`, `needs_check` levé, session `PARKED_CONFIRMED` ; `ASSIGNED`, `HELD`, `OCCUPIED` → 409 `SPOT_TAKEN` ; `OUT_OF_SERVICE` → 409 `SPOT_OUT_OF_SERVICE` ; une place libre que le véhicule ne peut pas prendre → 409 `SPOT_NOT_SUITABLE` (#125, ci-dessous) ; numéro absent du parking → 409 `UNKNOWN_SPOT`. 404 `SESSION_NOT_FOUND` pour la session d'un autre, 409 `NOT_ASKED` ou `SESSION_CLOSED`, 200 avec la première place pour une seconde réponse.
- **Lecture** : `GET /v1/me/session` et `GET /v1/entries/:sessionId` donnent la place répondue, sinon l'assignée ; `question: { aisleCode, freeSpotNumbers }` n'existe qu'en `PARKED_UNCONFIRMED` (places libres de l'allée vue, ordre naturel).
- **App** : l'écran de session n'affiche que la question (focus VoiceOver sur le titre), les places libres en boutons radio qui écrivent le numéro dans le champ (« Aucune place libre dans l’allée B » sinon), le champ pour tout autre numéro, « Confirmer B-3 » qui seul envoie (« Envoi… » pendant l'envoi), l'avis hors ligne sous le titre, puis « Garé en B-3 » avec le focus sur la place. Aucun moyen de passer la question.
- **Limites** (#126) : 10 réponses et 20 signaux de marche par conducteur en 10 minutes, comptés avant le verrou du parking, chaque appel compté qu'il soit accepté ou refusé ; au-delà, 429 `TOO_MANY_PARKED_ANSWERS` ou `TOO_MANY_PARKED_SIGNALS`, sans rien dire du numéro. Sous la limite, les refus restent distincts : le conducteur en a besoin pour corriger un numéro mal lu, et c'est la limite qui borne la lecture de l'état des places.

**Conséquences.** A-1 reste `OCCUPIED_UNKNOWN` et à vérifier, et garde l'index par place assignée jusqu'à la fin de la session (la sortie libère les deux). Risque accepté : un client qui ment sur l'allée peut prendre n'importe quelle place libre qui convient à son véhicule, et tenir deux places (la sienne, restée à vérifier, et celle qu'il nomme). Une place `HELD` pour un autre conducteur reste un cas bloqué : le conducteur ne peut que donner un autre numéro.

**Amendement #125 : une place réservée est refusée.** Le « risque accepté » d'origine était trop large : une voiture ordinaire pouvait nommer B-5 (accessible), A-5 (électrique) ou B-4 (surdimensionnée) et la tenir.
- **Une seule règle** : la réponse applique `spotFits(needs, spot)` de `chooseSpotFor.ts`, la même définition de « ce véhicule convient à cette place » que l'attribution et la liste des places libres de la question (#23). Aucune copie.
- **Ordre dans `placementOf`** : la place assignée à la session elle-même d'abord (jamais refusée, voir ci-dessous) ; puis l'état de la place (`SPOT_TAKEN`, `SPOT_OUT_OF_SERVICE` gardent la priorité : une place prise est « prise », quelle que soit sa réservation) ; puis `spotFits` → 409 `SPOT_NOT_SUITABLE` ('This spot does not suit your vehicle.'), distinct de `SPOT_TAKEN` ; enfin l'écriture. Un refus ne change ni place ni session, et la question reste posée.
- **Données** : `lockAnsweringSession` joint `vehicle` (besoins `coalesce`, un véhicule supprimé vaut standard, comme à l'attribution) et `lockAnsweredSpot` lit `is_ev`, `is_accessible`, `is_oversize`, sous les verrous existants (parking → session → place) ; le véhicule n'est pas écrit ici, donc aucun verrou de plus.
- **Sa propre place assignée n'est jamais contrôlée** : elle a été attribuée à ce véhicule ; un opérateur peut avoir coché un drapeau sur une place occupée (035), ou le véhicule avoir été modifié ou supprimé en cours de session.
- **Correction de la place présumée (021)** : même route, même `placementOf`, donc même refus.
- **Risque accepté** : les besoins sont lus sur le véhicule déclaré par le conducteur, avec la même confiance que l'attribution.
- **Écart de formulation connu** : le message est « réservée » ; un véhicule surdimensionné qui nomme une place standard le lit aussi, alors que la place n'est pas réservée. Aucun persona seedé n'est surdimensionné.
- **App** : « Cette place est réservée — vérifiez le numéro au sol » (EN « This spot is reserved — check the number on the ground »), sous le champ, la question reste affichée. Un code inconnu de l'app relirait la session sans message ; `SPOT_NOT_SUITABLE` est donc relié à son texte.

**Preuve SQL (#125).** `PostgresParkedAnswerRepository` exécuté sur la base de la voie, `palier_l125` (Parking Démo, seed), sessions insérées à la main ; base remise à zéro ensuite.

```
Julie (standard), question posée depuis A-1, répond B-5 (accessible)
  -> spot-not-suitable ; session PARKED_UNCONFIRMED ; A-1 OCCUPIED_UNKNOWN+check ; B-5 libre
Julie, répond A-5 (électrique)
  -> spot-not-suitable ; rien ne change
Julie, répond B-4 (surdimensionnée)
  -> confirmed B-4 ; session PARKED_CONFIRMED sur B-4 ; B-4 OCCUPIED ; A-1 OCCUPIED_UNKNOWN+check
Julie, B-5 refusée puis B-3
  -> spot-not-suitable (rien ne change), puis confirmed B-3 ; B-3 OCCUPIED
Julie, présumée sur A-1 (OCCUPIED), corrige vers B-5
  -> spot-not-suitable ; session PARKED_PRESUMED ; A-1 OCCUPIED ; rien ne change
Amélie (électrique + permis), question posée depuis B-1, répond A-5
  -> confirmed A-5 ; A-5 OCCUPIED ; B-1 OCCUPIED_UNKNOWN+check
Amélie, question posée depuis A-1, répond B-5
  -> confirmed B-5 ; B-5 OCCUPIED ; A-1 OCCUPIED_UNKNOWN+check
```
