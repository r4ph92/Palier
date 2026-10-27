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
(React Native avec Expo SDK 58, ouvert dans Expo Go sur le simulateur iOS) et
`packages/shared-types` (types échangés entre l'API et l'app). Les choix
d'implémentation sont dans [`docs/implementation.md`](docs/implementation.md),
la direction visuelle de l'app dans [`docs/design.md`](docs/design.md).

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
npm run seed --workspace @palier/api         # Parking Démo (10 places) et Garage Roy
npm run start --workspace @palier/api        # http://127.0.0.1:3000/v1/lots
```

Dans un second terminal :

```
npm run ios --workspace @palier/mobile       # Metro + Expo Go dans le simulateur
```

L'app appelle `http://localhost:3000` ; pour une autre adresse, copier
`apps/mobile/.env.example` en `apps/mobile/.env` et changer `EXPO_PUBLIC_API_URL`.
Si Expo Go affiche « UNIQUE constraint failed: updates.scope_key » à la
réouverture, toucher « Try again ».

### Scénarios de test manuels

- **Place hors service** : `npm run seed:spot-state --workspace @palier/api -- --lot "Parking Démo" --spot A-1 --state OUT_OF_SERVICE`,
  puis tirer la liste vers le bas : « 9 places libres ». Remettre la place avec
  `--state AVAILABLE`, ou tout réinitialiser avec `npm run seed --workspace @palier/api`.
- **API injoignable** : arrêter l'API (Ctrl+C dans son terminal, ou
  `kill $(lsof -ti tcp:3000 -sTCP:LISTEN)`), puis ouvrir l'app ou tirer vers le
  bas : « Impossible de joindre Palier. » et « Réessayer ». Relancer l'API puis
  toucher « Réessayer ».
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

Le seed et `seed:spot-state` refusent de tourner si `NODE_ENV` n'est pas
`development` ou `test`, ou si la base n'est pas sur `localhost`/`127.0.0.1`.

### Vérifications

```
npm run gate        # lint + typecheck + tests unitaires API (Vitest) + app (Jest)
npm run test:db     # optionnel : test du dépôt Postgres sur palier_test (Docker requis)
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
