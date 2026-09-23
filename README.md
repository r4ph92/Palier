# Palier

Système d'allocation de places en stationnement intérieur, multi-opérateurs.
Projet de cours — dossier de conception complet, avant implémentation.

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
