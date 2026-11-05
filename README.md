# Palier

Système d'allocation de places en stationnement intérieur, multi-opérateurs.
Projet de cours — dossier de conception complet ; l'implémentation a commencé
(voir « Lancer en local »).

## Le système en une page

Un conducteur voit la disponibilité des parkings avant de se déplacer et peut
bloquer une place 15 minutes le temps du trajet. À l'entrée, il scanne un QR à la
borne : le système lui assigne une place précise, pré-autorise le plafond
journalier sur sa carte et ouvre la barrière. La boucle de la barrière confirme
le passage et incrémente le compteur du parking.

Des balises BLE — une par allée — confirment la zone pendant la descente. Quand
le téléphone détecte la transition « en voiture → à pied » dans l'allée assignée,
la place est présumée occupée sans aucun geste. L'utilisateur n'est sollicité que
si l'allée détectée contredit l'assignation, ou s'il signale que sa place est prise.

À la sortie, le véhicule est identifié sans geste (balise de sortie vue par
l'app, ou ANPR chez les opérateurs équipés), le montant est capturé sur la
pré-autorisation, puis la barrière ouvre. Un tap dans l'app sert de repli.
Le compteur de passages garantit le nombre de places libres affiché ; des
capteurs par place, en option, garantissent lesquelles.

Un usager sans l'app scanne le même QR avec l'appareil photo : une page web avec
Apple Pay ou Google Pay pré-autorise le plafond, affiche la place, et le QR de
sortie ferme la session. Ni billet, ni caméra, ni terminal de paiement.

## État actuel (version de remise)

**Le document à remettre est `remise/Palier-dossier-de-conception.pdf`** (17 pages,
Letter). Il est généré à partir des sources HTML de `docs/` par
`tools/build_remise.py` : les treize diagrammes sont repris tels quels, la prose est
réécrite court, les tables de référence (flux, colonnes, endpoints, tâches) sont
reprises des sources. Régénérer après toute modification de `docs/` :

```
cd tools && python3 build_remise.py
```

Le rendu passe par Chrome en mode headless ; aucune autre dépendance.
`remise/Palier-dossier-de-conception.docx` est l'ancienne version Word (tour 7),
conservée pour mémoire, plus à jour.

## Lancer en local

Monorepo npm : `apps/api` (API Fastify + Drizzle sur Postgres), `apps/mobile`
(React Native avec Expo SDK 58, ouvert dans Expo Go sur le simulateur iOS),
`apps/dashboard` (tableau de bord opérateur, React + Vite) et
`packages/shared-types` (types échangés entre l'API et l'app). Les choix
d'implémentation sont dans [`docs/implementation.md`](docs/implementation.md),
la direction visuelle de l'app dans [`docs/design.md`](docs/design.md), le contrat du pont natif
et le panneau de signaux simulés dans [`docs/pont-natif.md`](docs/pont-natif.md).

### Prérequis

- **Node 24** (Expo 58 refuse Node 25). Avec Homebrew : `brew install node@24`,
  puis dans chaque terminal `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`
  (ou `nvm use`, le fichier `.nvmrc` indique 24).
- **Docker** pour Postgres (port 5433, pour ne pas entrer en conflit avec un
  Postgres local sur 5432).
- **Xcode** avec un simulateur iPhone. Expo Go s'installe tout seul au premier
  lancement ; ni CocoaPods ni build natif ne sont nécessaires pour l'instant.

### Démarrer

```
npm install
docker compose up -d --wait                  # bases palier et palier_test
cp apps/api/.env.example apps/api/.env       # NODE_ENV=development, base locale
npm run db:migrate
npm run seed --workspace @palier/api         # Parking Démo, Garage Roy, barrières et conducteurs de test
npm run start --workspace @palier/api        # http://127.0.0.1:3000 (/v1/lots exige un jeton)
```

Avec `DEMO_MODE=true` (valeur de `.env.example`), l'API sert aussi la console
de démonstration des barrières sur http://localhost:3000/demo/console ; clés et
scénarios dans [`docs/demo-console.md`](docs/demo-console.md).

Dans un second terminal :

```
npm run ios --workspace @palier/mobile       # Metro + Expo Go dans le simulateur
```

Copier `apps/mobile/.env.example` en `apps/mobile/.env` : il garde l'API sur
`http://localhost:3000` (`EXPO_PUBLIC_API_URL`) et active « Connexion de test »
(`EXPO_PUBLIC_TEST_SIGN_IN=true`). Sans ce fichier, l'écran de connexion n'offre
rien tant qu'Apple et Google (#30) ne sont pas là.

Tableau de bord opérateur, dans un autre terminal :

```
cp apps/dashboard/.env.example apps/dashboard/.env   # API_PORT=3000, VITE_TEST_SIGN_IN=true
npm run dev --workspace @palier/dashboard            # http://localhost:5173
```

Vite relaie `/v1` vers l'API sur `API_PORT` (`docs/decisions/010`). « Connexion
de test » propose Sophie Lavoie (Stationnements Lavoie inc.), Pierre Roy (Garages
Roy), Nouvel Opérateur (sans opérateur) et les conducteurs du seed.

Pour connecter un compte Stripe Express depuis le tableau de bord (#63), mettre
aussi `STRIPE_WEBHOOK_SECRET` dans `apps/api/.env` : lancer
`stripe listen --forward-to localhost:3000/v1/stripe/webhook` et copier le
`whsec_…` affiché (`docs/decisions/012`). Mode test seulement.

Pour que le seed crée les clients Stripe de test des conducteurs (carte Visa 4242
pour Julie et Marc), mettre une clé `sk_test_…` dans `STRIPE_SECRET_KEY` de
`apps/api/.env` ; sans clé, le seed les crée sans Stripe.
Si Expo Go affiche « UNIQUE constraint failed: updates.scope_key » à la
réouverture, toucher « Try again ».

### Scénarios de test manuels

- **Passages aux barrières** : voir [`docs/demo-console.md`](docs/demo-console.md)
  (entrée, sortie, « Complet », clé refusée, mauvaise barrière).
- **Connexion de test** : sur l'écran de connexion, toucher « Connexion de test »
  puis « Julie Tremblay » : l'accueil dit « Bonjour Julie ». Elle reste connectée
  après avoir tué et relancé l'app ; « Compte » > « Se déconnecter » ramène à la
  connexion et révoque son jeton. Avec `NODE_ENV=production` dans `apps/api/.env`,
  `curl -i http://127.0.0.1:3000/v1/test/drivers` répond 404.
- **Place hors service** : `npm run seed:spot-state --workspace @palier/api -- --lot "Parking Démo" --spot A-1 --state OUT_OF_SERVICE`,
  puis tirer la liste vers le bas : « 9 places libres ». Remettre la place avec
  `--state AVAILABLE`, ou tout réinitialiser avec `npm run seed --workspace @palier/api`.
- **API injoignable** : arrêter l'API (Ctrl+C dans son terminal, ou
  `kill $(lsof -ti tcp:3000 -sTCP:LISTEN)`), puis ouvrir l'app ou tirer vers le
  bas : « Impossible de joindre Palier. » et « Réessayer ». Relancer l'API puis
  toucher « Réessayer ».
- **Stationnements à proximité** (#5) : dans le Simulator, « Features » >
  « Location » > « Custom Location… », latitude `45.5048`, longitude `-73.5673`,
  puis accepter la localisation à l'ouverture de l'accueil : Parking Démo à
  « 350 m » avec « Standard 7 · Électrique 1 · Accessible 1 · Grand gabarit 1 »,
  puis Parking Test Paliers à « 570 m ». Refuser la localisation (ou la retirer
  dans Réglages > Expo Go) trie par nom avec « Activez la localisation pour trier
  par distance ». La liste se relit toute seule toutes les 30 secondes.
  En ligne de commande : `xcrun simctl location booted set 45.5048,-73.5673`.
- **Langue de l'appareil** : l'app suit la langue du simulateur (français par
  défaut, anglais si l'appareil est en anglais).

  ```
  xcrun simctl spawn booted defaults write -g AppleLanguages '("en-CA")'
  xcrun simctl spawn booted defaults write -g AppleLocale en_CA
  xcrun simctl list devices booted              # noter l'UDID
  xcrun simctl shutdown <UDID> && xcrun simctl boot <UDID>
  xcrun simctl openurl booted exp://127.0.0.1:8081
  ```

  Pour revenir au français : `'("fr-CA")'` et `fr_CA`, puis redémarrer de même.

Le seed, `seed:spot-state` et `load:entries` refusent de tourner si `NODE_ENV` n'est pas
`development` ou `test`, ou si la base n'est pas sur `localhost`, `127.0.0.1` ou `[::1]`.

### Charge d'entrées

Vingt conducteurs de charge (« Conducteur Test 01 » à « 20 ») scannent Entrée Démo
au même instant ; le script vérifie les réponses puis la base (décision 014).
Sans clé Stripe, lancer l'API avec des autorisations simulées :

```
npm run seed --workspace @palier/api
PAYMENTS_SIMULATION=success npm run start --workspace @palier/api
npm run load:entries --workspace @palier/api        # 20 conducteurs, 10 places
```

Attendu : `summary entries=20 expected=10 admitted=10 lot_full=10 other=0
distinct_spots=10 sessions=10 session_spots=10 intents=10 double_booked=0`, puis `OK`.
La ligne `summary` ne contient que des comptes : après un nouveau seed, une seconde
exécution donne la même. Le script refuse de tourner tant qu'un conducteur de charge
a une entrée active (« reseed first ») ; l'API n'admet que 5 entrées par conducteur en
10 minutes, la redémarrer entre deux séries (`TOO_MANY_ENTRIES`).

Trois conducteurs sur trois places libres, réponse en moins de 3 s :

```
npm run seed --workspace @palier/api
for spot in A-1 A-2 A-3 A-4 A-5 B-1 B-2; do
  npm run seed:spot-state --workspace @palier/api -- --lot "Parking Démo" --spot $spot --state OUT_OF_SERVICE
done
# redémarrer l'API (toujours avec PAYMENTS_SIMULATION=success)
npm run load:entries --workspace @palier/api -- --drivers 3 --max-latency-ms 3000
```

Le script révoque les jetons de ses conducteurs à la fin, et une erreur (argument, borne
inconnue, « reseed first ») s'affiche sur une ligne avec le code de sortie 1.

Options : `--api` (adresse locale seulement, défaut `http://127.0.0.1:$PORT`),
`--drivers` (1 à 20), `--gate` (une borne d'entrée semée), `--max-latency-ms`.

### Vérifications

```
npm run gate        # lint + typecheck + tests unitaires API (Vitest) + app (Jest) + tableau de bord (Vitest)
```

`gate` ne touche ni base ni simulateur ; la CI (`.github/workflows/ci.yml`)
exécute exactement les mêmes étapes. Après un changement du schéma
(`apps/api/src/infrastructure/postgres/schema.ts`), générer la migration avec
`npm run db:generate --workspace @palier/api`.

## Documents

| # | Document | Contenu |
|---|----------|---------|
| 01 | `docs/01-flux-de-donnees.html` | Diagramme de contexte et DFD de niveau 1, notation Gane-Sarson, 35 flux |
| 02 | `docs/02-modele-de-donnees.html` | Modèle relationnel (12 entités), machines à états place et session, surface API |
| 03 | `docs/03-sequences.html` | 4 diagrammes de séquence UML : entrée, confirmation, sortie, adhésion opérateur |
| 04 | `docs/04-architecture.html` | Couches de l'API, architecture React Native, contrat du pont natif |
| 05 | `docs/05-deploiement.html` | Déploiement, montage de démonstration, matériel, ordre de construction |
| — | `docs/palier-dossier-complet.html` | **Les cinq documents réunis en une seule page**, avec sommaire — la version à remettre |

Ouvrir un fichier directement dans un navigateur. Les pages s'adaptent au thème
clair ou sombre et comportent une feuille de style d'impression.

Les 49 décisions de conception qui ont produit ces documents sont consignées dans
[`DECISIONS.md`](DECISIONS.md).

## Pile technique retenue

| Couche | Choix |
|--------|-------|
| Application mobile | React Native (TypeScript) + modules natifs Swift ; MVP iOS seulement |
| Positionnement | BLE, une région iBeacon par parking (`major`), une balise par allée (`minor`) ; CoreMotion pour la détection de stationnement, app maintenue vivante par la localisation en arrière-plan depuis le scan |
| API | TypeScript, architecture en couches (adaptateurs / domaine / infrastructure) |
| Base de données | Postgres — assignation atomique par `FOR UPDATE SKIP LOCKED` |
| Paiement | Stripe Connect, comptes Express, charges destination, capture manuelle |
| Authentification | OAuth Apple + Google, aucun mot de passe stocké |
| Terrain | QR signés (HMAC) à l'entrée, boucles de barrière comme preuve de passage et compteur, identification à la sortie par ANPR, transpondeur ou balise BLE, ouverture par contact sec ou API du contrôle d'accès existant |

## Régénérer les diagrammes

Les documents 03 à 05 sont générés ; 01 et 02 sont écrits à la main.

```
cd tools
python3 build3.py && python3 assemble3.py    # séquences
python3 build4.py && python3 assemble4.py    # architecture
python3 build5.py && python3 assemble5.py    # déploiement
python3 assemble_all.py                      # fusion des cinq en une page
```

Les SVG intermédiaires sont écrits dans `tools/out/`, les pages finales dans `docs/`.

## Ordre de construction

1. Schéma Postgres et machines à états, avec les tests de transition
2. Domaine : allocation atomique, tarification, holds
3. API et adaptateurs, Stripe en mode test
4. **Module natif iOS** — balises et mouvement ; à faire tôt, c'est le risque technique du projet
5. Écrans React Native
6. Tableau de bord opérateur et adaptateur d'ouverture de barrière

L'étape 4 précède délibérément les écrans : c'est le seul chantier dont l'échec
remettrait en cause la conception elle-même.

## Reste ouvert

Aucune décision de conception n'est en suspens. Les tours 8 à 10 (Q33 à Q49) ont
retiré les caméras du chemin critique, rendu la confirmation de place implicite,
réglé le paiement et les balises, et ouvert le service aux usagers sans l'app par
le même QR. Trois points restent tranchés sans validation explicite, listés à la
fin de `DECISIONS.md`.
