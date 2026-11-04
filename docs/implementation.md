# Choix d'implémentation

Ce qui a été tranché en construisant, au-delà du dossier de conception. Une
ligne par choix ; la raison suit le tiret.

## Pile

- **Monorepo npm workspaces** (`apps/api`, `apps/mobile`, `packages/shared-types`) — un seul `npm install`, types partagés sans publication.
- **API : Fastify 5, Drizzle ORM, postgres-js**, exécutée directement par Node 24 (suppression native des types, sans étape de build) — moins d'outillage pour un prototype.
- **Couches** : `http/` (routes), `domain/` (règles, ports), `infrastructure/postgres/` (schéma, dépôts), comme dans `docs/04`.
- **App : Expo SDK 58**, configuration dans `app.config.ts`, dossiers `ios/` et `android/` générés et ignorés par git ; Expo Go suffit tant qu'aucun module natif n'existe. Le module balises (P03) passera à `expo-dev-client`.
- **Node 24** (`.nvmrc`, `engines`) — Expo 58 refuse Node 25.
- **Tests** : Vitest pour l'API, Jest (`jest-expo`) et Testing Library pour l'app. `npm run gate` n'exécute que des tests unitaires. Le projet n'a aucun test de base de données, d'intégration ou de navigateur (voir `docs/decisions/005-tests-unitaires-uniquement.md`).
- **Postgres 17 dans Docker sur le port 5433**, base de test créée par `docker/postgres/init`.
- **React épinglé par `overrides`** à la version d'Expo — sinon npm installe deux copies de React dans le monorepo et les tests plantent.

## Modèle de données (écarts et ajouts par rapport à `docs/02`)

- `parking_lot.is_online` (booléen, faux par défaut) — le dossier ne dessine pas de drapeau « en ligne » ; Garage Roy existe sans être visible.
- `parking_lot.latitude` / `longitude` (numériques, nulles) à la place de `geo`, non typé dans le dossier ; la distance arrive en #5.
- `aisle.lot_id` et `spot.lot_id` dénormalisés, avec clés étrangères composées `(level_id, lot_id)` et `(aisle_id, lot_id)` — la base garantit qu'une place appartient au parking de son allée, et `UNIQUE (lot_id, number)` est une vraie contrainte.
- `UNIQUE (lot_id, beacon_minor)` sur `aisle` et `UNIQUE beacon_major` sur `parking_lot` — Q40 : un major par parking, un minor par allée.
- `spot.current_session_id` n'existe pas : c'est `parking_session.assigned_spot_id` qui pointe vers la place, avec un index unique partiel sur les sessions actives (#36, `docs/decisions/007`).
- `session` du dossier s'appelle `parking_session` (#36) : `user_id`, `vehicle_id` (nullable, `ON DELETE SET NULL`) et `plate` copiée à l'entrée, `lot_id`, `assigned_spot_id` et `entry_gate_id` avec clés étrangères composées vers `spot(id, lot_id)` et `gate(id, lot_id)`, `state` (`CREATED`, `CANCELLED` pour l'instant), `payment_intent_id`, `authorized_cents`, `entry_scan_at`, `cancelled_at`.
- `gate_command` (#36) : `gate_id`, `lot_id`, `kind` (`OPEN`), `session_id`, `issued_at` à la milliseconde — la commande d'une barrière simulée, lue par la console.
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
- Le nombre affiché passe par une seule fonction, `domain/occupancy/freeSpotCount` : `max(0, min(capacité − véhicules, places libres))` (Q35, D6).

## Barrières et passages (#11)

- Tables `gate`, `gate_device_key` et `gate_passage` (migration `0007`) ; clés hachées et passage en une seule instruction SQL : voir `docs/decisions/006`.
- `gate.qr_secret` est nullable tant que les QR signés (#36) n'existent pas ; `integration_kind` gagne `SIMULATED` (D5). Entrée Roy est en `DRY_CONTACT`, non vérifiée.
- Une barrière sans boucles (`has_loops = false`) refuse les passages (409) ; les trois barrières semées en ont.
- Erreurs des routes de barrière : `{ statusCode, error, message }` avec `error` = code machine (`DEVICE_KEY_REFUSED`, `GATE_FORBIDDEN`, `GATE_WITHOUT_LOOPS`, `CLOSED_AT_INVALID`, `CLOSED_AT_IN_FUTURE`).
- `DEMO_MODE` (`true`/`false`, faux par défaut) n'est pas refusé sous `NODE_ENV=production` (D13 tel qu'écrit : une démo hébergée peut tourner ainsi) ; le serveur journalise un avertissement au démarrage.
- Pas de limitation de débit sur les routes de barrière pour le prototype.
- Les routes de barrière et la console sont exemptées du consentement (`routeClassification.ts`) : un contrôleur signe avec une clé d'appareil, pas un jeton de conducteur. `MINIMUM_APP_VERSION` ne s'applique qu'aux routes de l'app, enregistrées dans leur propre portée Fastify ; un contrôleur n'envoie pas de version d'app.

## Entrée par QR (#36)

- Contenu du QR, vérification, ordre des étapes et compensation : `docs/decisions/007`. QR des bornes semées : `docs/demo-console.md`.
- `POST /v1/entries { qrContent }` (jeton de conducteur, consentement) → 201 `{ sessionId, spot: { number, levelCode, aisleCode }, barrierOpened: true }`. Refus `{ statusCode, error, message }` : `QR_NOT_RECOGNIZED` 400, `NOT_AN_ENTRY_GATE`, `LOT_NOT_IN_SERVICE`, `OPERATOR_NOT_PAYABLE`, `PREREQUISITES_MISSING`, `LOT_FULL`, `ALREADY_INSIDE` 409, `CARD_DECLINED` 402, `GATE_UNAVAILABLE` et `PAYMENTS_UNAVAILABLE` 503.
- Cas d'utilisation découpé en deux : `EntryEligibility` (lectures seulement) puis `EntryAdmission` (place et session, autorisation, ouverture). Les dépendances sont toujours construites ; sans `STRIPE_SECRET_KEY`, seul l'autorisateur de paiement manque : les refus de QR et de prérequis répondent normalement, et une entrée admissible reçoit 503 `PAYMENTS_UNAVAILABLE` avant qu'une place soit prise.
- Première place libre : ordre du palier, code d'allée, puis chiffres de fin du numéro (A-2 avant A-10). La place accessible B-5 reste attribuable jusqu'aux filtres de #43 et #44.
- Pré-autorisation : `capture_method: manual`, plafond journalier du parking en CAD, `transfer_data.destination` = compte de l'opérateur, `metadata.sessionId`, clé d'idempotence `entry-<sessionId>`, client Stripe à 2,5 s et 1 relance réseau, pour que les deux tentatives et l'attente entre elles restent sous le délai de 8 s de l'app. Un statut autre que `requires_capture` ou une erreur de carte donne `CARD_DECLINED` ; toute autre erreur Stripe `PAYMENTS_UNAVAILABLE`, avec le `sessionId` au journal.
- Limite : 5 entrées admissibles par conducteur en 10 minutes (429 `TOO_MANY_ENTRIES`), comptées après les contrôles — un QR refusé ne consomme rien et n'atteint jamais Stripe.
- `DEMO_OPERATOR_STRIPE_ACCOUNT_ID` (`acct_…`, facultatif) est lu par le seed, qui l'écrit sur Stationnements Lavoie. Le seed ajoute aussi un véhicule par défaut à Julie (`ABC 123`), Marc (`XYZ 789`), Amélie (`EVA 001`) et Éric (`DEC 404`), en Québec ; Nadia n'en a pas.
- **Écart connu jusqu'à #39 (D4)** : si l'app abandonne après 8 s alors que le serveur a admis l'entrée, la place reste attribuée et l'autorisation tenue ; un nouveau scan répond « Vous avez déjà une entrée en cours ». L'annulation à 60 s et le balayage de #39 refermeront ce trou.

## Console de démonstration

- Fichiers statiques dans `apps/api/src/http/demo/`, listés dans une seule table (`demoAssets.ts`), lus au démarrage et servis seulement en mode démo, avec une CSP sans `unsafe-inline` (polices comprises, `font-src 'self'`), `nosniff`, `no-referrer` et `no-store`. Guide : `docs/demo-console.md`.
- La logique est découpée par raison de changer : `consoleText.js` (textes, heures, pluriels), `gateApi.js` (client HTTP), `loopPress.js` (déroulé d'un appui), `commandFeed.js` (commandes interrogées chaque seconde, curseur = `issuedAt` et `id` de la dernière, comparés en ligne `(issued_at, id) > (…)` pour ne perdre aucune des commandes d'une même milliseconde, dédoublonnées par id) et `consoleTranslations.js` (textes FR/EN) ; c'est du JavaScript avec types JSDoc, vérifié par `tsc` (`allowJs` + `checkJs`) et testé par Vitest ; aucun build pour le navigateur.
- Polices : Archivo 400/600 et IBM Plex Mono 400/500 servies par l'API depuis `@expo-google-fonts` (dépendances de `apps/api`), `font-display: swap`, CSP `font-src 'self'`.
- Heures `18 h 02` / `6:02 PM` formatées à la main comme dans l'app (même règle, code dupliqué : l'app et la page ne partagent aucun module d'exécution).

## App

- Langue : celle de l'appareil au lancement ; anglais si l'appareil est en anglais, sinon français. Pluriel français : 0 et 1 au singulier.
- Erreur réseau, statut non 2xx, corps illisible ou délai de 8 s : tous affichent « Impossible de joindre Palier. » ; un rafraîchissement raté retire les chiffres affichés plutôt que de laisser des comptes périmés. Un statut non 2xx lève `PalierStatusError` (sous-type de `PalierUnreachableError`, avec le statut) ; toute autre erreur n'est pas déguisée en « injoignable » et remonte au rendu.
- À 0 place libre, la ligne affiche « Complet » / « Full » après le carré `danger` ; VoiceOver lit « Complet, 0 place libre ».
- L'en-tête affiche l'heure de la dernière lecture réussie (« Mis à jour à 13 h 25 », « Updated 1:25 PM ») selon la convention d'heure du backlog, formatée à la main parce que l'Intl de Hermes sur iOS rend « 13:25 » en fr-CA ; un bouton « Actualiser » double le geste de tirer vers le bas.
- Le jeton vit dans le trousseau iOS (`expo-secure-store`). Au lancement, l'app le relit et appelle `GET /v1/me` : 200 ouvre l'accueil, 401 efface le jeton et montre la connexion, API injoignable montre « Impossible de joindre Palier. » avec « Réessayer ».
- Un 401 sur la liste des parkings efface le jeton et ramène à l'écran de connexion. « Se déconnecter » efface le jeton tout de suite et révoque côté serveur au mieux (sans attendre le réseau).
- Navigation : un état `lots | scan | account` dans `PalierApp` et une barre d'onglets maison, sans bibliothèque de navigation. Depuis « Scanner », « Ajouter une plaque » et « Ajouter une carte » ouvrent directement la page correspondante de « Compte ».
- « Scanner » (#36) prend le contenu du QR dans un champ texte : Expo Go n'a pas de lecteur de code-barres et la caméra arrive avec #45. Le résultat n'est pas conservé quand on change d'onglet ; la vue de session viendra avec #37.
- Les clients authentifiés (véhicules, entrée) passent par `api/authorizedRequest.ts` : 401 déconnecte, 403 `CONSENT_REQUIRED` remontre l'avis, les statuts de refus listés par le client portent le code de l'API, tout autre statut lève `PalierStatusError`.
- « Connexion de test » n'apparaît que si le build porte `EXPO_PUBLIC_TEST_SIGN_IN=true` (voir `apps/mobile/.env.example`).
