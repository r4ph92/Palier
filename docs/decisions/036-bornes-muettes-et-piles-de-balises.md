# 036 — Bornes muettes et piles de balises

**Contexte.** docs/05 fait du signal de vie des contrôleurs et du suivi des piles des exigences d'exploitation. Q47 dit qu'un contrôleur hors ligne refuse l'entrée ; côté Palier, rien ne savait qu'une borne s'était tue (#76).

**Décision.**
- **Signal de vie** : `POST /v1/gates/:id/heartbeat`, clé d'appareil seule, sans corps, 204. La base garde `gate.last_heartbeat_at` (migration 0036), horodaté par l'horloge du serveur, jamais par la console. L'écriture est un simple `update … where id and lot_id` : un instant futur laissé par une horloge de test déplacée est corrigé par le signal suivant. La clé d'une autre barrière reçoit 403 `GATE_FORBIDDEN` (`ensureOwnGate`, partagé avec les passages).
- **Santé** (`domain/equipment/gateHealth.ts`) : aucun signal, `NEVER_HEARD` ; plus de 120 s strictement depuis le dernier, `SILENT` ; sinon `ONLINE`. Calculée dans le domaine avec l'horloge composée, jamais par `now()` en SQL.
- **Entrée refusée à une borne muette** : `EntryEligibility` refuse `GATE_SILENT` (503) après les contrôles du parking et avant toute place ou autorisation Stripe. L'app affiche « Borne hors service — entrée impossible ». Choix produit, réversible : une borne `NEVER_HEARD` admet encore les entrées (un parc installé avant ce suivi, et la démo avant que la console tourne) ; une sortie n'est jamais refusée (Q47 : un parking ne retient pas ses usagers).
- **Horloge** : le signal, l'admissibilité, les écritures de pile et les lectures du tableau de bord prennent l'horloge composée (l'horloge de test quand la connexion de test est active), pour que QA rende une borne muette en avançant `PUT /v1/test/clock`. La route des barrières est composée dans un `register` pour que `buildServer` refuse de démarrer sans horloge de test, comme avant. Les passages gardent l'horloge système.
- **Tableau de bord** : `GET /v1/dashboard/lots/:id/equipment` → `{ lotId, lotName, now, gates: [{ id, name, kind, health, lastHeartbeatAt }] }`, entrées d'abord. `now` est l'instant du serveur : la page dit « Muette depuis 14 h 05 » le jour même et ajoute la date sinon (« Muette depuis le 12 novembre, 14 h 05 »), en comparant à `now`, jamais à l'horloge de l'ordinateur. Jamais `qr_secret` ni `endpoint`. L'occupation gagne `silentGateNames` (même règle) pour la bannière « Borne muette : Entrée Démo » / « Bornes muettes : A, B », sans second sondage.
- **Piles** : `aisle.beacon_battery_percent` (smallint, 0 à 100) et `aisle.beacon_battery_reported_at`, ensemble ou pas du tout (contraintes `aisle_beacon_battery_percent_range` et `aisle_beacon_battery_reading_complete`). La dernière lecture l'emporte. Statut (`domain/equipment/batteryStatus.ts`) : 20 % ou moins, `LOW` ; aucune lecture ou une lecture de plus de 90 jours, `UNKNOWN` ; sinon `OK`. Le seuil de 20 % est un choix produit réversible. Les seuils (20 %, 90 jours, 2 minutes) sont des constantes de `packages/shared-types` que le tableau de bord insère dans ses textes.
- **Deux sources de lecture** : la barrière, `POST /v1/gates/:id/beacons/:minor/battery` `{ percent }` (204 ; minor sans zéro de tête, 0 à 65535 ; minor absent du parking de la barrière, 404 `BEACON_NOT_FOUND`) ; le personnel, `PUT /v1/dashboard/lots/:id/aisles/:aisleId/beacon-battery` `{ percent }` qui répond le plan entier, comme les autres écritures du plan. Parking d'un autre opérateur, 404 `LOT_NOT_FOUND` ; allée hors du parking, 404 `AISLE_NOT_FOUND`. Pas de verrou du parking : une seule mise à jour, bornée à l'opérateur ; le parking n'est relu que si elle ne change aucune ligne, pour distinguer `LOT_NOT_FOUND` d'`AISLE_NOT_FOUND`. Les deux sources écrivent la lecture par le même fragment SQL (`beaconBatteryAssignment`). La règle du pourcentage est une seule fonction, `beaconBatteryErrors` (`packages/shared-types`), appliquée par le formulaire et l'API : `BATTERY_PERCENT_INVALID` 400.
- **Où** : les bornes ont leur page « Équipement » ; les piles sont une colonne du tableau « Balises » de la page du plan, avec une saisie par ligne.
- **Console** : elle envoie un signal dès qu'une clé bien formée est saisie et au retour en ligne, puis toutes les 30 s ; rien hors ligne ; arrêt sur 401 ou 403 jusqu'à la prochaine saisie de la clé ; une réponse pour une clé que le champ ne tient plus est ignorée.

**Sécurité.** Les quatre routes sont dans `routeClassification.ts`. Une clé de barrière volée peut écraser les lectures de pile de tout son parking (pas d'autre parking : le minor est cherché dans le parking de la barrière) et faire paraître la borne en ligne. Les routes `/v1/gates` n'ont toujours pas de limitation de débit (décision 031) ; la clé d'appareil reste le seul frein.

**Preuve du SQL.** Les tests unitaires à SQL scripté (`fakes/scriptedSql.ts`) vérifient la portée par opérateur, l'allée dans le parking, le minor dans le parking de la barrière et le refus à 0 ligne. Il n'existe pas de suite sur Postgres (décision 002) ; les scénarios ont été rejoués à la main sur `palier_l65` le 13 novembre 2026, dans une transaction annulée ensuite :

| Scénario | Résultat |
|---|---|
| Signal d'Entrée Démo dans son parking | `UPDATE 1` |
| Même signal avec l'id de Parking Test Paliers | `UPDATE 0` |
| Pile du minor 1 de Parking Démo par la barrière | `UPDATE 1`, allée A |
| Pile du minor 3, qui n'existe qu'à Parking Test Paliers | `UPDATE 0` |
| Pile de l'allée B de Parking Démo par Lavoie | `UPDATE 1` |
| Même écriture par Garages Roy | `UPDATE 0` |
| Allée C de Parking Test Paliers sous l'id de Parking Démo | `UPDATE 0` |
| Contrôle de propriété de Parking Démo par Garages Roy | 0 ligne |
| Pourcentage 101 | refus, `aisle_beacon_battery_percent_range` |
| Pourcentage sans instant | refus, `aisle_beacon_battery_reading_complete` |
| Lecture des bornes de Parking Démo par Lavoie | Entrée Démo puis Sortie Démo, sans secret |
| Même lecture par Garages Roy | 0 ligne |

Après l'annulation, aucune borne n'a de signal et aucune allée de lecture.

**Conséquences.** Une démo dont Entrée Démo a déjà battu doit garder la console ouverte pour les entrées suivantes : deux minutes sans signal, et l'entrée est refusée. Un onglet caché ralentit les minuteries à environ une fois par minute, sous les 120 s ; `docs/demo-console.md` le note.

**Compromis acceptés (test d'intrusion du 14 novembre 2026).**

- **Oracle de présence.** Un conducteur connecté qui scanne une borne obtient `GATE_SILENT` si la borne est muette et `PREREQUISITES_MISSING` si un prérequis manque : il peut donc deviner si la console d'une entrée est active. L'information est faible et les scans refusés ne sont pas limités en débit ; la limitation est un suivi, hors de cette histoire.
- **Horloge de test.** La route d'horloge de test déplace l'instant qui décide du silence d'une borne sur les instances de développement et de démonstration. Pour la démo, garder `/v1/test/*` hors du réseau local.
- **Lectures de pile sans source.** Une lecture de pile ne garde pas d'où elle vient (clé de barrière ou saisie d'un opérateur) ; la dernière écriture l'emporte, comme pour le signal des bornes.
