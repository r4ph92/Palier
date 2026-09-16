# Palier

Système d'allocation de places en stationnement intérieur, multi-opérateurs.
Projet de cours — dossier de conception complet, avant implémentation.

## Le système en une page

Un conducteur voit la disponibilité des parkings avant de se déplacer et peut
bloquer une place 15 minutes le temps du trajet. À l'entrée, il scanne un QR à la
borne : le système lui assigne une place précise, pré-autorise le plafond
journalier sur sa carte et ouvre la barrière. Une caméra placée après la barrière
lit la plaque arrière et confirme l'entrée effective.

Des balises BLE — une par allée — confirment la zone pendant la descente. Quand
le téléphone détecte la transition « en voiture → à pied », une notification
demande la confirmation de la place en un tap ; l'utilisateur peut corriger le
numéro s'il s'est garé ailleurs.

À la sortie, la caméra lit la plaque, le montant est capturé sur la
pré-autorisation existante, puis la barrière ouvre. Aucun geste requis.

## État actuel (version de remise)

**Le document à remettre est `remise/Palier-dossier-de-conception.docx`.** Il a divergé
des sources HTML de `docs/`, qui restent la version complète :

- Section *Déploiement et matériel* retirée (diagramme de déploiement, montage de démo).
- Annexe *Journal des décisions* retirée — `DECISIONS.md` reste la référence complète.
- Prose resserrée d'environ 20 %, légendes intactes ; tableaux réduits de 38 à 24.
- Mise en page : images plafonnées à 7 × 8 po, lignes de tableau insécables,
  table des matières reconstruite (20 entrées, actualisée par Word à l'ouverture).

Points ouverts :

- Rendu jamais vérifié visuellement (pas de LibreOffice sur la machine) — à relire dans Word.
- Trois décisions prises sans validation explicite, listées à la fin de `DECISIONS.md`.

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

Les 32 décisions de conception qui ont produit ces documents sont consignées dans
[`DECISIONS.md`](DECISIONS.md).

## Pile technique retenue

| Couche | Choix |
|--------|-------|
| Application mobile | React Native (TypeScript) + modules natifs Swift ; MVP iOS seulement |
| Positionnement | BLE, une balise par allée ; CoreMotion pour la détection de stationnement |
| API | TypeScript, architecture en couches (adaptateurs / domaine / infrastructure) |
| Base de données | Postgres — assignation atomique par `FOR UPDATE SKIP LOCKED` |
| Paiement | Stripe Connect, comptes Express, charges destination, capture manuelle |
| Authentification | OAuth Apple + Google, aucun mot de passe stocké |
| Terrain | QR signés (HMAC) aux bornes, ANPR à la sortie, ouverture par contact sec ou API du contrôle d'accès existant |

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

Aucune décision de conception n'est en suspens. Trois points ont été tranchés
sans validation explicite et méritent une relecture : le remplissage allée par
allée plutôt que place par place, le garde-fou de 30 minutes sur les assignations
orphelines, et l'implémentation du QR avant l'ANPR au prototype alors que le
produit cible fait l'inverse.
