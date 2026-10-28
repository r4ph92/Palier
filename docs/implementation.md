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
- `app_user` (#29) : `email`, `first_name`, `last_name`, `stripe_customer_id`, `default_pm_id`. `first_name` et `last_name` sont ajoutés au dossier pour « Bonjour Julie » et la liste de test ; `oauth_provider` et `oauth_subject` sont reportés à #30 — pas de colonne sans usage.
- `user_session_token` (#29) : `token_hash` (SHA-256, clé primaire), `user_id`, `created_at`, `revoked_at` — voir `docs/decisions/004`.
- Conducteurs du seed : Julie Tremblay et Marc Gagnon (carte de test Visa `pm_card_visa`), Nadia Bouchard (sans carte, pour les stories qui bloquent un conducteur sans carte). Avec `STRIPE_SECRET_KEY` (clé `sk_test_` seulement, une clé live est refusée), le seed crée leurs clients Stripe sur la plateforme et réutilise ceux d'un seed précédent ; sans clé, ils sont créés sans identifiants Stripe.

## API

- `GET /v1/lots` exige un jeton de conducteur (`Authorization: Bearer …`) depuis #29 ; sans jeton, jeton inconnu ou révoqué : 401. Réponse `[{ id, name, freeSpots }]` des parkings en ligne, triés par nom, filtrée par un schéma de réponse Fastify.
- La liste est bornée à 50 parkings (`ONLINE_LOTS_LIMIT`) — sans distance ni pagination, une liste non bornée grossirait avec chaque opérateur ; #5 remplacera ce tri par la distance et revisitera la borne.
- `GET /v1/me` renvoie `{ id, firstName }` du conducteur connecté ; `POST /v1/sign-out` révoque le jeton (204).
- `GET /v1/test/drivers` et `POST /v1/test/sign-in { driverId }` n'existent qu'avec `NODE_ENV` à `development` ou `test` ; ailleurs, 404. Un `driverId` qui n'est pas un UUID donne 400 ; les champs en trop sont retirés par Fastify avant le handler.
- Toute erreur 5xx renvoie un corps générique (`Internal Server Error`) ; le détail (SQL compris) ne va qu'au journal du serveur.
- Le nombre affiché passe par une seule fonction, `domain/occupancy/freeSpotCount` ; #11 y ajoutera `min(capacité − véhicules, places libres)` (Q35, D6).

## App

- Langue : celle de l'appareil au lancement ; anglais si l'appareil est en anglais, sinon français. Pluriel français : 0 et 1 au singulier.
- Erreur réseau, statut non 2xx, corps illisible ou délai de 8 s : tous affichent « Impossible de joindre Palier. » ; un rafraîchissement raté retire les chiffres affichés plutôt que de laisser des comptes périmés. Un statut non 2xx lève `PalierStatusError` (sous-type de `PalierUnreachableError`, avec le statut) ; toute autre erreur n'est pas déguisée en « injoignable » et remonte au rendu.
- L'en-tête affiche l'heure de la dernière lecture réussie (« Mis à jour à 13 h 25 », « Updated 1:25 PM ») selon la convention d'heure du backlog, formatée à la main parce que l'Intl de Hermes sur iOS rend « 13:25 » en fr-CA ; un bouton « Actualiser » double le geste de tirer vers le bas.
- Le jeton vit dans le trousseau iOS (`expo-secure-store`). Au lancement, l'app le relit et appelle `GET /v1/me` : 200 ouvre l'accueil, 401 efface le jeton et montre la connexion, API injoignable montre « Impossible de joindre Palier. » avec « Réessayer ».
- Un 401 sur la liste des parkings efface le jeton et ramène à l'écran de connexion. « Se déconnecter » efface le jeton tout de suite et révoque côté serveur au mieux (sans attendre le réseau).
- Navigation : un état `lots | account` dans `PalierApp` et une barre d'onglets maison, sans bibliothèque de navigation.
- « Connexion de test » n'apparaît que si le build porte `EXPO_PUBLIC_TEST_SIGN_IN=true` (voir `apps/mobile/.env.example`).
