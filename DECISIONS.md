# Décisions de conception

30 décisions tranchées lors d'une session de cadrage, en six tours. Chaque tour ne
posait que les questions dont les prémisses étaient déjà réglées. Trois questions
ont été reformulées en cours de route parce qu'elles manquaient le vrai enjeu.

## Contraintes établies

Ces points n'ont jamais été soumis au choix — ce sont des propriétés des
plateformes, du droit applicable ou de la physique du lieu. Ils ont fermé des
branches entières de l'arbre de conception.

- **L'achat intégré Apple est interdit** pour les services du monde physique. Le
  stationnement en est un : la facturation passe obligatoirement par Stripe.
- **Le GPS est inutilisable sous une dalle de béton.** Tout le positionnement
  intérieur repose sur le BLE.
- **iOS limite le monitoring à 20 régions** par app, et le *ranging* fiable exige
  le premier plan. D'où : UUID unique, `major` = allée, `minor` = balise.
- **Le *ranging* BLE a une marge de ±2 à 3 m**, une place fait 2,6 m. Une balise
  par place donnerait couramment la mauvaise place — confiante et fausse.
- **CoreMotion expose les transitions `automotive → stationary → walking`** en
  arrière-plan. C'est le mécanisme d'Apple pour « Voiture garée ».
- **La déconnexion Bluetooth de l'autoradio n'est pas exposée** aux apps tierces.
- **Au Québec, seule la plaque arrière est obligatoire.** Une caméra visant
  l'avant ne lit rien sur une bonne part du parc.
- **Loi 25** : plaque + horodatages + positions = renseignement personnel.
  Consentement, durée de conservation définie, évaluation des facteurs relatifs à
  la vie privée.
- **Android n'a pas d'équivalent d'iBeacon** et bride le scan en arrière-plan
  depuis la version 8. Contournement accepté : service de premier plan.
- **La règle 4.8 de l'App Store** impose Sign in with Apple dès qu'un autre login
  tiers est offert.
- **En charges directes Stripe, une carte enregistrée sur la plateforme n'est pas
  réutilisable** chez un opérateur sans cloner le moyen de paiement.
- **`FOR UPDATE SKIP LOCKED`** élimine les assignations concurrentes au niveau du
  SGBD, pas en logique applicative.

## Tour 1 — Cadrage

| # | Décision | Réponse |
|---|----------|---------|
| Q1 | Nature du livrable | Prototype fonctionnel en environnement contrôlé |
| Q2 | Population desservie | App-only — pas d'app, pas d'entrée |
| Q3 | Source de vérité de l'occupation | *Reformulée → Q7, puis Q12* |
| Q4 | Connectivité en sous-sol | Wi-Fi, pré-requis à la charge de l'opérateur (voir Q30) |
| Q5 | Rôle des balises BLE | Confirmation de zone — une balise par allée |
| Q6 | Paiement | Carte enregistrée, pré-autorisation à l'entrée, capture à la sortie |

**Q2 est structurante** : c'est parce qu'il n'existe aucun véhicule inconnu dans
le système que la vérité déclarative de Q12 devient défendable.

**Q5** : pas de guidage continu type GPS intérieur. La contrainte iOS l'impose, et
un conducteur qui fixe son téléphone dans un garage est un mauvais produit avant
d'être un problème technique.

**Q6** : la seule option où la barrière de sortie n'est pas un goulot
d'étranglement. Un écran de paiement entre une voiture et une barrière, avec la
file derrière, est un défaut de conception.

## Tour 2 — Points de contact

| # | Décision | Réponse |
|---|----------|---------|
| Q7 | Granularité de la vérité terrain | *Reformulée → Q12* |
| Q8 | Ouverture de la barrière d'entrée | QR unique à la borne |
| Q9 | Identification du véhicule | Plaque obligatoire à l'inscription |
| Q10 | Modèle de réservation | Aucune réservation à l'avance ; `ASSIGNED` naît au scan d'entrée |
| Q11 | Tarification | Politique configurable par opérateur |

**Q7** opposait des supports de marqueur (QR, NFC, capteur). Le vrai enjeu est le
**mécanisme de contrainte** : comment forcer la confirmation, ou comment la
produire à la place de l'utilisateur. Changer de support ne change pas le nombre
de poses.

**Q8** : le scan d'entrée est le seul moment où l'on peut garantir un téléphone
déverrouillé, l'app vivante et les permissions actives — ce dont dépend toute la
chaîne qui suit.

**Q10** : l'état est nommé `ASSIGNED` et non `RESERVED` pour marquer qu'il ne
s'agit pas d'une réservation.

## Tour 3 — Le mécanisme central

| # | Décision | Réponse |
|---|----------|---------|
| Q12 | Confirmation de la place | Inférence + tap, contrainte à la sortie en dernier recours |
| Q13 | Fin d'une assignation non confirmée | Le signal *walking* termine l'état, pas la confirmation |
| Q14 | Portée multi-tenant | Plateforme multi-opérateurs |
| Q15 | Algorithme d'assignation | Attributs du véhicule d'abord, puis remplissage par palier |

**Q12** — la chaîne complète : entrée dans la région de l'allée → réveil de l'app
en arrière-plan → transition *automotive → walking* → notification locale. Un tap,
sans ouvrir l'app, au moment où l'utilisateur ferme sa portière. L'inférence seule
donne l'allée et l'instant, jamais le numéro ; la contrainte seule punirait
l'utilisateur pour un défaut de conception.

**Q13** — « jusqu'à ce que l'utilisateur se rende à sa place » signifie *jusqu'à
ce qu'il se gare*, pas jusqu'à ce qu'il confirme. La place bascule alors en
`OCCUPIED` ou `OCCUPIED_UNKNOWN`, jamais en `AVAILABLE`.

**Q14** — choix assumé contre la recommandation : la valeur croît avec le nombre
de parkings couverts. Coût accepté : Stripe Connect, KYC par opérateur,
répartition des fonds, responsabilité des litiges.

**Q15** — le remplissage se fait **allée par allée** dans le palier ; un
remplissage séquentiel strict concentrerait toutes les voitures au même endroit.

## Tour 4 — Argent et saturation

| # | Décision | Réponse |
|---|----------|---------|
| Q16 | Modèle Stripe Connect | Charges destination, comptes Express |
| Q17 | Parking plein | La barrière refuse ; occupation visible dans l'app en amont |
| Q18 | Réconciliation des places douteuses | *Reformulée → Q20 et Q21* |
| Q19 | Montant de la pré-autorisation | Plafond journalier obligatoire dans la config |

**Q16** — en charges destination, le client et sa carte vivent une seule fois sur
la plateforme et fonctionnent chez tous les opérateurs.

**Q18** — la proposition de caméras de plaques a ouvert une vraie capacité, mais
répond à une autre question : *une caméra de barrière dit qu'une voiture est
entrée ou sortie, jamais dans quelle place elle s'est garée.*

**Q19** — sans plafond, aucun montant n'est défendable avant de connaître la
durée : soit la capture échoue à la sortie, soit on bloque un montant arbitraire.

## Tour 5 — Caméras, découverte, données

| # | Décision | Réponse |
|---|----------|---------|
| Q20 | Rôle de la lecture de plaques | QR à l'entrée · ANPR à la sortie, QR en repli |
| Q21 | Sort des places `OCCUPIED_UNKNOWN` | Libérées à la sortie, marquées « à vérifier », proposées en dernier recours |
| Q22 | Découverte des places disponibles | Hold court de 15 min, un par utilisateur, quota par parking |
| Q23 | Conservation des données | 90 jours sur les données identifiantes, puis agrégation anonymisée |

**Q20** — asymétrie délibérée. La caméra d'entrée confirme l'entrée effective du
véhicule mais ne déclenche rien ; le QR reste le déclencheur. À la sortie, la
plaque ferme la session sans geste et garantit la facturation même téléphone
éteint.

**Q22** — sans garantie, la promesse du réseau est fausse. Le hold court la rend
vraie ; le quota empêche quelques utilisateurs d'assécher le parc. C'est une
garantie de trajet, pas une réservation.

**Q23** — purger dès le règlement laisserait sans preuve face à une
rétrofacturation Stripe, qui peut survenir des semaines plus tard.

## Tour 6 — Réalisation

| # | Décision | Réponse |
|---|----------|---------|
| Q24 | Plateformes clientes | Base de code multiplateforme — l'iOS seul est écarté |
| Q25 | Surface opérateur | Tableau de bord web réel, mais restreint |
| Q26 | Montage de la démonstration | Barrière simulée (relais + témoin) · balises réelles |
| Q27 | Authentification | OAuth Apple + Google ; plaque et carte exigées à l'inscription |
| Q28 | Structure du code client | React Native + modules natifs |
| Q29 | Portée du MVP | iOS seulement |
| Q30 | Le Wi-Fi comme condition d'adhésion | Pré-requis à la charge de l'opérateur |

**Q24 et Q29 ne se contredisent pas** : Q24 porte sur la base de code, Q29 sur la
portée. Un seul codebase dès le départ, module natif iOS seulement pour le MVP,
Android devenant un module à ajouter — pas une app à réécrire.

**Q26** — les balises doivent être réelles, une balise simulée ne prouve rien du
comportement en arrière-plan. La barrière n'a rien à prouver.

**Q30** — l'onboarding d'un parking commence par une checklist technique
(couverture aux paliers et aux deux bornes) avant même le volet Stripe. La
croissance est bornée aux parkings couverts ou prêts à investir ; l'installation
par la plateforme reste une porte de sortie commerciale, pas un engagement.

## Tour 7 — Intégration à la barrière

| # | Décision | Réponse |
|---|----------|---------|
| Q31 | Comment Palier ouvre une barrière existante | Contact sec **et** API du contrôle d'accès, selon l'équipement |
| Q32 | Matériel de barrière pour la démonstration | Aucun — toutes les ouvertures sont confirmées dans l'application |

**Origine de ces deux questions** : le Raspberry Pi, décidé en Q26 pour le seul montage
de démonstration, avait fui dans le diagramme de déploiement et dans le tableau du
document 04, qui décrivent le système réel. Un artefact de prototype présenté comme de
l'architecture produit.

**Q31** — Palier n'installe pas de barrières, il commande celles qui sont déjà là. Le
contact sec est le dénominateur commun de tout le parc : tout opérateur industriel
s'ouvre en fermant un relais. L'API du système de contrôle d'accès évite d'ajouter du
matériel, mais n'existe que sur les installations récentes. D'où les deux, avec le
contact sec comme socle.

Un Raspberry Pi en production aurait été refusé par n'importe quelle équipe de
maintenance : carte SD qui se corrompt à la coupure, pas de chien de garde matériel,
aucune plage de température industrielle, aucun contrat de support — le tout pour
fermer un contact. Ce qui se pose vraiment est un module relais sur rail DIN.

**Conséquence sur le modèle** : la table `gate` gagne `integration_kind`, `endpoint` et
`verified_at`. La barrière devient un **deuxième pré-requis d'adhésion**, à côté du
Wi-Fi de Q30 — et probablement le plus bloquant des deux, puisqu'il touche à de
l'équipement sous contrat de service.

**Q32** — Sans barrière physique, le montage se réduit aux deux balises, qui sont le
seul matériel dont la simulation prouverait quelque chose de faux. Une barrière ne
démontre rien que la capture Stripe et l'écran de l'application ne démontrent déjà.

## Décisions prises sans validation explicite

Trois points ont été tranchés en cours de rédaction et méritent une relecture.

1. **Remplissage allée par allée** plutôt que place par place en séquence (Q15).
2. **Garde-fou de 30 minutes** sur les assignations orphelines, malgré le refus du
   TTL en Q10 — présenté comme hygiène de données, pas comme politique produit.
3. **Le prototype implémente le QR d'abord et l'ANPR en second chemin**, alors que
   le produit cible fait l'inverse (Q20).
