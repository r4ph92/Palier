# Choix d'implémentation

Ce qui a été tranché en construisant, au-delà du dossier de conception. Une
ligne par choix ; la raison suit le tiret.

## Pile

- **Monorepo npm workspaces** (`apps/api`, `apps/mobile`, `packages/shared-types`) — un seul `npm install`, types partagés sans publication.
- **API : Fastify 5, Drizzle ORM, postgres-js**, exécutée directement par Node 24 (suppression native des types, sans étape de build) — moins d'outillage pour un prototype.
- **Couches** : `http/` (routes), `domain/` (règles, ports), `infrastructure/postgres/` (schéma, dépôts), comme dans `docs/04`.
- **App : Expo SDK 58**, configuration dans `app.config.ts`, dossiers `ios/` et `android/` générés et ignorés par git ; Expo Go suffit tant qu'aucun module natif n'existe. Le module balises (P03) passera à `expo-dev-client`.
- **Node 24** (`.nvmrc`, `engines`) — Expo 58 refuse Node 25.
- **Tests** : Vitest pour l'API, Jest (`jest-expo`) et Testing Library pour l'app. `npm run gate` n'exécute que des tests unitaires ; `npm run test:db` (optionnel, hors CI) vérifie le dépôt Postgres et les contraintes sur `palier_test`.
- **Postgres 17 dans Docker sur le port 5433**, base de test créée par `docker/postgres/init`.
- **React épinglé par `overrides`** à la version d'Expo — sinon npm installe deux copies de React dans le monorepo et les tests plantent.

## Modèle de données (écarts et ajouts par rapport à `docs/02`)

- `parking_lot.is_online` (booléen, faux par défaut) — le dossier ne dessine pas de drapeau « en ligne » ; Garage Roy existe sans être visible.
- `parking_lot.latitude` / `longitude` (numériques, nulles) à la place de `geo`, non typé dans le dossier ; la distance arrive en #5.
- `aisle.lot_id` et `spot.lot_id` dénormalisés, avec clés étrangères composées `(level_id, lot_id)` et `(aisle_id, lot_id)` — la base garantit qu'une place appartient au parking de son allée, et `UNIQUE (lot_id, number)` est une vraie contrainte.
- `UNIQUE (lot_id, beacon_minor)` sur `aisle` et `UNIQUE beacon_major` sur `parking_lot` — Q40 : un major par parking, un minor par allée.
- `spot.current_session_id` est reporté à la story qui crée `session` — pas de colonne sans table cible.
- `kyc_status` : `NOT_STARTED`, `PENDING`, `VERIFIED` ; `assignment_strategy` : `AISLE_BY_AISLE` seulement (Q15).
- `capacity` et `vehicle_count` ne peuvent pas être négatifs (contrainte CHECK, D6).
- Garage Roy : capacité 0, plafond journalier 25,00 $, sans palier ni place — le tableau de fixtures ne lui donne que sa borne d'entrée (story ultérieure).

## API

- `GET /v1/lots` sans authentification pour l'instant (#29 ajoutera le jeton) ; réponse `[{ id, name, freeSpots }]` des parkings en ligne, triés par nom, filtrée par un schéma de réponse Fastify.
- La liste est bornée à 50 parkings (`ONLINE_LOTS_LIMIT`) — sans distance ni pagination, une liste non bornée grossirait avec chaque opérateur ; #5 remplacera ce tri par la distance et revisitera la borne.
- Toute erreur 5xx renvoie un corps générique (`Internal Server Error`) ; le détail (SQL compris) ne va qu'au journal du serveur.
- Le nombre affiché passe par une seule fonction, `domain/occupancy/freeSpotCount` : `max(0, min(capacité − véhicules, places libres))` (Q35, D6).

## Barrières et passages (#11)

- Tables `gate`, `gate_device_key` et `gate_passage` (migration `0001`) ; clés hachées et passage en une seule instruction SQL : voir `docs/decisions/004`.
- `gate.qr_secret` est nullable tant que les QR signés (#36) n'existent pas ; `integration_kind` gagne `SIMULATED` (D5). Entrée Roy est en `DRY_CONTACT`, non vérifiée.
- Une barrière sans boucles (`has_loops = false`) refuse les passages (409) ; les trois barrières semées en ont.
- Erreurs des routes de barrière : `{ statusCode, error, message }` avec `error` = code machine (`DEVICE_KEY_REFUSED`, `GATE_FORBIDDEN`, `GATE_WITHOUT_LOOPS`, `CLOSED_AT_INVALID`, `CLOSED_AT_IN_FUTURE`).
- `DEMO_MODE` (`true`/`false`, faux par défaut) n'est pas refusé sous `NODE_ENV=production` (D13 tel qu'écrit : une démo hébergée peut tourner ainsi) ; le serveur journalise un avertissement au démarrage.
- Pas de limitation de débit sur les routes de barrière pour le prototype.

## Console de démonstration

- Fichiers statiques dans `apps/api/src/http/demo/` (HTML, CSS, trois modules JS), lus au démarrage et servis seulement en mode démo, avec une CSP sans `unsafe-inline`, `nosniff`, `no-referrer` et `no-store`. Guide : `docs/demo-console.md`.
- La logique (`consoleLogic.js`, `consoleTranslations.js`) est du JavaScript avec types JSDoc, vérifié par `tsc` (`allowJs` + `checkJs`) et testé par Vitest ; aucun build pour le navigateur.
- Polices : pile système avec Archivo et IBM Plex Mono en premier choix ; la CSP n'autorise pas de police distante.
- Heures `18 h 02` / `6:02 PM` formatées à la main comme dans l'app (même règle, code dupliqué : l'app et la page ne partagent aucun module d'exécution).

## App

- Langue : celle de l'appareil au lancement ; anglais si l'appareil est en anglais, sinon français. Pluriel français : 0 et 1 au singulier.
- Erreur réseau, statut non 2xx, corps illisible ou délai de 8 s : tous affichent « Impossible de joindre Palier. » ; un rafraîchissement raté retire les chiffres affichés plutôt que de laisser des comptes périmés. Un statut non 2xx lève `PalierStatusError` (sous-type de `PalierUnreachableError`, avec le statut) ; toute autre erreur n'est pas déguisée en « injoignable » et remonte au rendu.
- À 0 place libre, la ligne affiche « Complet » / « Full » après le carré `danger` ; VoiceOver lit « Complet, 0 place libre ».
- L'en-tête affiche l'heure de la dernière lecture réussie (« Mis à jour à 13 h 25 », « Updated 1:25 PM ») selon la convention d'heure du backlog, formatée à la main parce que l'Intl de Hermes sur iOS rend « 13:25 » en fr-CA ; un bouton « Actualiser » double le geste de tirer vers le bas.
