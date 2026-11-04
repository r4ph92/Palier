# Choix d'implémentation

Ce qui a été tranché en construisant, au-delà du dossier de conception. Une
ligne par choix ; la raison suit le tiret.

## Pile

- **Monorepo npm workspaces** (`apps/api`, `apps/mobile`, `apps/dashboard`, `packages/shared-types`) — un seul `npm install`, types partagés sans publication.
- **API : Fastify 5, Drizzle ORM, postgres-js**, exécutée directement par Node 24 (suppression native des types, sans étape de build) — moins d'outillage pour un prototype.
- **Couches** : `http/` (routes), `domain/` (règles, ports), `infrastructure/postgres/` (schéma, dépôts), comme dans `docs/04`.
- **App : Expo SDK 58**, configuration dans `app.config.ts`, dossiers `ios/` et `android/` générés et ignorés par git ; Expo Go suffit tant qu'aucun module natif n'existe. Le module balises (P03) passera à `expo-dev-client`.
- **Node 24** (`.nvmrc`, `engines`) — Expo 58 refuse Node 25.
- **Tests** : Vitest pour l'API, Jest (`jest-expo`) et Testing Library pour l'app. `npm run gate` n'exécute que des tests unitaires. Le projet n'a aucun test de base de données, d'intégration ou de navigateur (voir `docs/decisions/005-tests-unitaires-uniquement.md`).
- **Postgres 17 dans Docker sur le port 5433**, base de test créée par `docker/postgres/init`.
- **React et React DOM épinglés par `overrides`** à la version d'Expo — sinon npm installe deux copies de React dans le monorepo et les tests plantent.

## Modèle de données (écarts et ajouts par rapport à `docs/02`)

- `parking_lot.is_online` (booléen, faux par défaut) — le dossier ne dessine pas de drapeau « en ligne » ; Garage Roy existe sans être visible.
- `parking_lot.latitude` / `longitude` (numériques, nulles) à la place de `geo`, non typé dans le dossier ; la distance arrive en #5.
- `aisle.lot_id` et `spot.lot_id` dénormalisés, avec clés étrangères composées `(level_id, lot_id)` et `(aisle_id, lot_id)` — la base garantit qu'une place appartient au parking de son allée, et `UNIQUE (lot_id, number)` est une vraie contrainte.
- `UNIQUE (lot_id, beacon_minor)` sur `aisle` et `UNIQUE beacon_major` sur `parking_lot` — Q40 : un major par parking, un minor par allée.
- `spot.current_session_id` n'existe pas : c'est `parking_session.assigned_spot_id` qui pointe vers la place, avec un index unique partiel sur les sessions actives (#36, `docs/decisions/007`).
- `session` du dossier s'appelle `parking_session` (#36) : `user_id`, `vehicle_id` (nullable, `ON DELETE SET NULL`) et `plate` copiée à l'entrée, `lot_id`, `assigned_spot_id` et `entry_gate_id` avec clés étrangères composées vers `spot(id, lot_id)` et `gate(id, lot_id)`, `state` (`CREATED`, `ENTRY_CONFIRMED` depuis #37, `CANCELLED`), `payment_intent_id`, `authorized_cents`, `entry_scan_at`, `cancelled_at`.
- `parking_session.pricing_increment_cents`, `pricing_increment_minutes`, `pricing_daily_cap_cents` (#38) : le tarif du parking copié à l'entrée (D1) — voir `docs/decisions/011`. Le seed donne à Garage Roy et à Parking Test Paliers le même tarif que Parking Démo (0,75 $ par 15 minutes, plafond 25,00 $).
- `parking_session.hold_release_pending` (booléen, faux par défaut) et `hold_release_attempted_at` (#39) : l'autorisation d'une session annulée attend sa libération par Stripe ; index partiel sur `hold_release_attempted_at` des sessions en attente — voir `docs/decisions/012`.
- `gate_command` (#36) : `gate_id`, `lot_id`, `kind` (`OPEN`), `session_id`, `issued_at` à la milliseconde — la commande d'une barrière simulée, lue par la console. Index sur `session_id` (#39) pour retrouver l'ouverture d'une session.
- `kyc_status` : `NOT_STARTED`, `PENDING`, `VERIFIED` ; `assignment_strategy` : `AISLE_BY_AISLE` seulement (Q15).
- `capacity` et `vehicle_count` ne peuvent pas être négatifs (contrainte CHECK, D6).
- Garage Roy : capacité 0, plafond journalier 25,00 $, sans palier ni place — le tableau de fixtures ne lui donne que sa borne d'entrée (story ultérieure).
- `app_user` (#29) : `email`, `first_name`, `last_name`, `stripe_customer_id`, `default_pm_id`. `first_name` et `last_name` sont ajoutés au dossier pour « Bonjour Julie » et la liste de test ; `oauth_provider` et `oauth_subject` sont reportés à #30 — pas de colonne sans usage.
- `user_session_token` (#29) : `token_hash` (SHA-256, clé primaire), `user_id`, `created_at`, `revoked_at` — voir `docs/decisions/004`. `scope` (`APP` | `DASHBOARD`, #62) sépare les jetons de l'app de ceux du tableau de bord — voir `docs/decisions/010`.
- `operator_member` (#62) : `user_id` (clé primaire, donc un opérateur par utilisateur), `operator_id` (indexé), `created_at` — l'appartenance D7, absente de `docs/02`. Seed : Sophie Lavoie (Lavoie), Pierre Roy (Roy), Nouvel Opérateur (aucun) ; « Parking Test Paliers » (Lavoie, hors ligne, sans palier ni place).
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
- **Écart refermé par #39 (D4)** : si l'app abandonne après 8 s alors que le serveur a admis l'entrée, la place reste attribuée et l'autorisation tenue jusqu'au passage suivant de la tâche d'annulation, une minute à une minute et demie plus tard ; d'ici là, un nouveau scan répond « Vous avez déjà une entrée en cours ».

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
- « Scanner » (#36) prend le contenu du QR dans un champ texte : Expo Go n'a pas de lecteur de code-barres et la caméra arrive avec #45. Le résultat n'est pas conservé quand on change d'onglet ; la session en cours prend le relais (#38).
- Les clients authentifiés (véhicules, entrée) passent par `api/authorizedRequest.ts` : 401 déconnecte, 403 `CONSENT_REQUIRED` remontre l'avis, les statuts de refus listés par le client portent le code de l'API, tout autre statut lève `PalierStatusError`.
- « Connexion de test » n'apparaît que si le build porte `EXPO_PUBLIC_TEST_SIGN_IN=true` (voir `apps/mobile/.env.example`).
- Signaux de positionnement : `positioning/` porte le port `PositioningModule` et `PositioningCore` (commandes transmises, événements diffusés). Le module simulé et le panneau « Signaux simulés » vivent dans `dev/` et ne sont chargés que par `dev/loadDeveloperTools.ts`, derrière un ternaire `__DEV__` que Metro évalue à la compilation : ils sont absents du bundle de production (voir `docs/pont-natif.md`).

## Tableau de bord opérateur (#62)

- `apps/dashboard` : Vite 8, React 19.3, TypeScript, sans routeur (le chemin est l'état : `/`, `/lots/:id`, sinon « Introuvable »). Lancer : `npm run dev --workspace @palier/dashboard` avec `apps/dashboard/.env` (`API_PORT`, `VITE_TEST_SIGN_IN`) ; Vite relaie `/v1` vers `http://127.0.0.1:${API_PORT}`.
- Session par cookie `palier_dashboard` et en-tête `X-Requested-With: palier-dashboard` sur chaque écriture : `docs/decisions/010`. La page ne lit jamais le jeton ; `GET /v1/dashboard/me` dit qui est connecté.
- Langue : français par défaut, bouton « English » / « Français » mémorisé dans `localStorage` (`palier.language`) ; `lang` et le titre de l'onglet suivent. Les codes d'erreur de l'API deviennent des phrases du dictionnaire, jamais le message anglais de l'API.
- « Connexion de test » vit dans `src/testSignIn/` (client, textes, section), chargé seulement derrière `import.meta.env.DEV` : un `vite build` ne contient ni la section ni ses routes ni ses textes.
- Jetons de couleur : `src/theme/tokens.css` reprend `apps/mobile/src/theme/tokens.ts` (clair et sombre) ; `test/themeTokens.test.ts` échoue si les couleurs, les espacements ou la cible tactile divergent. Polices servies depuis `@expo-google-fonts`, sans requête externe.
- Un utilisateur sans opérateur ne voit que « Créer votre opérateur », quelle que soit l'adresse. La règle de la raison sociale est une seule fonction, `isValidLegalName` dans `packages/shared-types/src/dashboard.ts`, appliquée par l'API et le tableau de bord : de 2 à 120 caractères comptés en points de code après retrait des espaces, sans caractère de contrôle ni de format (NUL, espaces de largeur nulle, marques de direction) ; sinon `LEGAL_NAME_INVALID`. Un second opérateur est refusé (`OPERATOR_EXISTS`) et la page relit alors la session.
- Toute réponse 401 relit `GET /v1/dashboard/me` et ramène à la page de connexion si la session a pris fin. Les identifiants des personas de test sont dans `apps/api/src/config/testPersonas.ts`, partagés par le seed et les routes de connexion de test.

## Session en cours (#38)

- Tarif figé à l'entrée, départ de la facturation au scan, arrondi et horloge de test : `docs/decisions/011`.
- `GET /v1/me/session` (jeton de conducteur, consentement) → `{ session: null }` ou `{ session: { sessionId, state, lotName, spot, enteredAt, elapsedMinutes, amountCents, dailyCapCents } }`, calculé par l'API avec son horloge. Une session est « en cours » en `CREATED` ou `ENTRY_CONFIRMED` (`ACTIVE_ENTRY_SESSION_STATES`, dont le texte SQL sert aussi aux index partiels de la décision 007). Pas d'identifiant dans le chemin : un conducteur ne lit que la sienne ; la session d'un autre reste un 404 sur `GET /v1/entries/:sessionId`.
- L'app garde trois onglets. La session vit dans l'onglet « Scanner », qui s'appelle « Session » tant qu'une session est en cours. La session est lue au-dessus des onglets (`useCurrentParkingSession`) à la connexion ou au relancement, puis chaque minute ; à la première réponse qui contient une session, l'app ouvre cet onglet, sauf si le conducteur a déjà choisi un onglet.
- Règle d'affichage de l'onglet : entrée en cours d'envoi, barrière ouverte ou entrée annulée → écran de scan (la place, le suivi de la boucle et l'annonce VoiceOver ne sont jamais coupés) ; sinon session en cours → écran de session ; sinon formulaire de scan, précédé de « Aucune session en cours » quand Palier a répondu qu'il n'y en a pas.
- Un rafraîchissement raté garde la session affichée avec « Mis à jour à 21 h 17 » : un conducteur sans réseau au sous-sol a toujours besoin de sa place.
- Montants `9,75 $` / `$9.75` (`formatMoney`) et durée `3 h 15` / `3 h 15 min` (`formatElapsed`), formatés à la main comme l'heure ; chiffres en IBM Plex Mono tabulaire.
- Horloge de test, en développement seulement (port de la voie à adapter) :

```sh
curl -X PUT localhost:3000/v1/test/clock -H 'content-type: application/json' -d '{"now":"2026-11-05T02:17:00Z"}'
curl localhost:3000/v1/test/clock
curl -X PUT localhost:3000/v1/test/sessions/<sessionId>/entered-at -H 'content-type: application/json' -d '{"enteredAt":"2026-11-04T23:02:00Z"}'
curl -X DELETE localhost:3000/v1/test/clock
```

  Les heures sont en UTC : 23 h 02 Z est 18 h 02 à Montréal en novembre. L'horloge fixée reste figée jusqu'au prochain `PUT` ou `DELETE`, et revient à l'heure réelle au redémarrage de l'API.

## Annulation des entrées sans passage (#39)

- Règles, verrous, horloge et libération de l'autorisation : `docs/decisions/012`.
- Configuration (`apps/api/.env.example`) : `ENTRY_CONFIRMATION_WINDOW_SECONDS` (60 par défaut, 30 au moins) et `ENTRY_CANCELLATION_PERIOD_SECONDS` (30 par défaut, au plus la fenêtre) ; fenêtre + période ≤ 110 s, sinon l'API refuse de démarrer. Lus par `config/entryCancellationTiming.ts`.
- Tâche : `scheduler/startUnconfirmedEntryCancellation.ts` lance à chaque période `cancelUnconfirmedEntries` puis `releasePendingHolds` (`domain/entries/unconfirmedEntryCancellation.ts`), chacune ignorée si la précédente tourne encore ; l'arrêt du serveur attend l'annulation en cours, pas une libération bloquée sur Stripe. Dépôt : `PostgresUnconfirmedEntryRepository` ; l'annulation partage `cancelCreatedSession` avec le retour arrière de l'entrée.
- Journal : `cancelled an entry nobody drove through` (info, `sessionId`), `released the card hold of a cancelled entry`, `Stripe did not release the card hold, retried at the next check` (avertissement), `card holds wait for release: the server has no Stripe key` (avertissement, `pending`).
- App : le suivi de l'entrée reçoit `CANCELLED` et affiche « Entrée annulée : aucun passage détecté. Aucun montant retenu. » / « Entry cancelled: no passage detected. Nothing charged. » au-dessus du formulaire, comme une alerte annoncée par VoiceOver ; l'onglet redevient « Scanner ». Après « Terminé » avant la boucle, `usePendingEntryWatch` (au-dessus des onglets) continue de suivre l'entrée, jusqu'à 2 min, et affiche le même message au retour sur « Scanner », jusqu'au scan suivant.
