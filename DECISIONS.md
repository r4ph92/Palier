# Décisions de conception

49 décisions tranchées en dix tours : six tours de cadrage, un tour sur la barrière, et trois tours de relecture pratique. Le premier a retiré les caméras du chemin critique, le deuxième a réglé le paiement, les balises et la survie de l'app, le troisième a rendu l'entrée et la sortie étanches et ouvert le service aux usagers sans l'app. Chaque tour ne
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
  le premier plan. D'où : UUID unique, `major` = parking, `minor` = allée (revu en Q40 ;
  la version initiale mettait l'allée dans `major`, ce qui donnait une région par allée).
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
- **Toute barrière industrielle a des boucles inductives** dans la chaussée : une
  boucle d'armement avant la lisse, une boucle de sécurité sous la lisse. Le
  contrôleur les expose en contacts, exactement comme la commande d'ouverture.
  C'est une preuve de passage gratuite, insensible à la neige et à l'éclairage.
- **Une plaque arrière n'est lisible qu'une partie de l'année au Québec** : neige,
  support à vélo, attache-remorque. Une conception dont l'exactitude dépend de la
  lecture de plaque est fausse plusieurs mois par an.

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

## Tour 8 — Relecture pratique : sortir les caméras du chemin critique

Tour ouvert sur une question précise : *peut-on garantir l'exactitude des places
disponibles sans caméra, et sans demander plus de gestes à l'usager ?* La réponse
tient en une observation : la caméra de barrière n'a jamais donné l'exactitude des
places (Q18 le disait déjà), elle ne servait qu'à identifier le véhicule à la
sortie. Deux problèmes distincts, deux réponses distinctes.

| # | Décision | Réponse |
|---|----------|---------|
| Q33 | Preuve de passage à la barrière | La boucle du contrôleur, à l'entrée comme à la sortie ; la caméra d'entrée disparaît |
| Q34 | Identification du véhicule à la sortie | Chaîne ordonnée : ANPR ou transpondeur si l'opérateur en a, sinon balise de sortie vue par l'app, sinon un tap, sinon le personnel |
| Q35 | Vérité du nombre de places libres | Le compteur de passages des boucles ; jamais plus de places libres affichées que le compteur n'en permet |
| Q36 | Confirmation de la place | Présomption d'exactitude : aucun geste au cas nominal, une question seulement si l'allée détectée contredit l'allée assignée |
| Q37 | Vérité place par place | Capteurs par place en option opérateur ; seule garantie possible de *quelle* place est libre |

**Q33** — La preuve d'entrée était la lecture de la plaque arrière après la
barrière, avec annulation de la session après 2 minutes sans lecture. Une plaque
enneigée transformait donc un usager entré et garé en session annulée, sans issue
à la sortie. La fermeture de la boucle de sécurité après la commande d'ouverture
prouve la même chose, pour tout véhicule, par tout temps. La règle devient :
aucun passage 60 secondes après l'ouverture → session `CANCELLED`, place libérée,
pré-autorisation annulée. C'est le cas que la règle des 2 minutes visait vraiment
(barrière en panne, conducteur qui recule), et il est rare. Le contrôleur remonte
la fermeture par `POST /v1/gates/{id}/passage`.

**Q34** — Sans caméra, quatre façons d'identifier le véhicule qui sort, de la plus
automatique à la moins, chacune ne servant que si la précédente échoue :

1. **ANPR ou transpondeur (AVI)**, si l'opérateur en est équipé. Sans geste. Le
   transpondeur pare-brise est ce qu'utilisent les stationnements pour leurs
   abonnés ; il lit à 99,9 % mais exige de remettre une étiquette à chaque usager.
   `gate.exit_id_kind` vaut `ANPR`, `RFID` ou `NONE`.
2. **La balise de sortie vue par l'app.** Une balise BLE à la voie de sortie ;
   l'app signale qu'elle la voit (`POST /v1/sessions/{id}/at-exit`). Si une seule
   session active du parking l'a signalée dans les 60 dernières secondes **et**
   qu'un véhicule est présent sur la boucle d'armement, l'API capture et ouvre.
   Sans geste. Deux téléphones à la sortie → on passe à l'étape suivante.
3. **Un tap « Ouvrir » dans l'app**, qui remplace le scan du QR de sortie. Un
   geste, mais le même que le ticket qu'il remplace.
4. **Le personnel** (interphone, code), pour le téléphone déchargé. C'est le cas
   du ticket perdu ; il faut le dire dans le dossier plutôt que le laisser
   découvrir.

La caméra devient une intégration optionnelle pour le confort, jamais un maillon
de l'exactitude. Bénéfice collatéral pour la Loi 25 : un opérateur sans ANPR ne
filme personne.

**Q35** — Les boucles comptent *tous* les véhicules, y compris ceux que Palier ne
voit pas (abonnés à carte, visiteurs d'un ancien système). Entrées moins sorties
est donc la vérité du nombre de voitures dans le parking, exactement comme les
panneaux « places libres » des centres-villes depuis trente ans.
`parking_lot.vehicle_count` est maintenu de façon atomique à chaque passage ;
`capacity` est saisi au plan. Le nombre affiché dans l'app vaut
`min(capacity − vehicle_count, places AVAILABLE)` : on ne promet jamais plus que
ce que le compteur permet. La tâche `reconcile_counts` compare chaque minute le
compteur au nombre de places occupées ; l'écart est le nombre de places à
vérifier, affiché tel quel au tableau de bord. Un parking à population mixte
(abonnés + Palier) garde ainsi un nombre exact même si les places individuelles
sont floues.

**Q36** — La confirmation par tap devient facultative. Le signal *walking* dans
l'allée assignée suffit : la place passe à `OCCUPIED`, la session à
`PARKED_PRESUMED`. L'usager n'est sollicité que dans deux cas :

- **L'allée détectée n'est pas l'allée assignée** → notification « Où êtes-vous
  garé ? », l'ancienne place passe à `OCCUPIED_UNKNOWN` avec `needs_check`.
- **La place assignée est prise** (abonné, voiture mal garée) → un tap « Place
  prise » avant de se garer ; l'API réassigne immédiatement, dans la même allée
  si possible, et la place signalée passe à `OCCUPIED_UNKNOWN`.

Aucun signal du tout (téléphone déchargé, permission refusée) → le garde-fou de
30 minutes **présume** la place assignée occupée au lieu de la libérer. Libérer
une place dont on ne sait rien la faisait réassigner à un second véhicule ; la
présumer occupée coûte une place, jamais une collision. Le compteur de Q35 borne
l'erreur cumulée.

**Q37** — La seule façon de garantir *quelle* place est libre est un capteur par
place (ultrasons au plafond ou magnétomètre au sol — les feux rouges et verts des
centres commerciaux). C'est aussi la seule façon de voir les véhicules hors
Palier place par place. Coût de l'ordre d'une balise par place, donc une option
d'opérateur : `parking_lot.occupancy_source` vaut `DECLARATIVE` (défaut) ou
`SENSORS`. En mode capteurs, `spot.sensor_state` fait autorité sur
`OCCUPIED`/`AVAILABLE`, l'assignation reste celle de Palier, et une place assignée
dont le capteur bascule avant l'arrivée de l'usager est réassignée et poussée à
l'app sans geste. Les capteurs remontent par `POST /v1/lots/{id}/sensors` (clé
d'appareil). Hors périmètre de la démonstration.

**Conséquences sur le modèle** : `session` perd `entry_plate_at`,
`entry_plate_read` et `plate_mismatch`, gagne `entry_passage_at`,
`exit_passage_at`, `exit_id_method` et `parked_evidence` ; `PARKED_UNCONFIRMED`
est renommé `PARKED_PRESUMED`. `gate` gagne `exit_id_kind` et `has_loops`.
`parking_lot` gagne `capacity`, `vehicle_count` et `occupancy_source`. `spot`
gagne `sensor_state` et `sensor_at`. La balise de sortie porte `minor = 0` dans
l'allée « sortie ». `POST /v1/gates/{id}/plate` devient
`POST /v1/gates/{id}/identify` (plaque ou transpondeur). Cinq tâches planifiées
au lieu de quatre.

**Ce que le tour 8 ne tranchait pas** est réglé au tour 9.

## Tour 9 — Paiement, balises, survie de l'app

| # | Décision | Réponse |
|---|----------|---------|
| Q38 | Échec de capture à la sortie | Impossible par la carte : le montant est pré-autorisé. Seule panne restante, Stripe injoignable → ouvrir, capturer au retour |
| Q39 | Séjours de plus d'un jour | Hors MVP ; session plafonnée à 24 h, limite documentée |
| Q40 | Cartographie des régions iBeacon | Une région par parking : `major` = parking, `minor` = allée, voie de sortie = `minor` 0 |
| Q41 | Survie de l'app entre le scan et le signal *walking* | Localisation en arrière-plan démarrée au scan, arrêtée à la présomption |

**Q38** — La question était mal posée. Le montant capturé à la sortie est
toujours inférieur ou égal au plafond journalier pré-autorisé à l'entrée, et la
session est plafonnée à 24 h (Q39), donc toujours dans la validité de
l'autorisation. Un refus de carte à la sortie n'existe pas. Il ne reste qu'une
panne : Stripe ou le réseau injoignable au moment de la capture. Les fonds étant
déjà bloqués, la règle « jamais d'ouverture avant capture » n'a plus rien à
protéger dans ce cas : la barrière ouvre, la capture est rejouée par le
planificateur jusqu'à succès, le reçu part à ce moment-là. La règle absolue de la
séquence C devient : *jamais d'ouverture sans autorisation valide* — et elle est
garantie par l'entrée, pas par la sortie.

**Q39** — Un séjour de plus de 24 h dépasse le plafond pré-autorisé et, au-delà de
sept jours, l'autorisation elle-même. Ré-autoriser chaque nuit est faisable
(autorisation incrémentale Stripe) mais n'apporte rien à la démonstration. Le MVP
plafonne la session à 24 h ; au-delà, la capture prend le plafond et la
différence est facturée hors session sur la carte enregistrée. Annoncé comme
limite connue, pas caché.

**Q40** — Une région par allée (`major` = allée) dépassait la limite de vingt
régions dès un parking moyen, et les portées BLE se chevauchant d'une allée à
l'autre, les entrées et sorties de région se seraient succédé sans arrêt. La
région devient le parking : l'app ne surveille que celui où elle est entrée,
`minor` identifie l'allée, la voie de sortie porte `minor` 0. L'allée est
résolue par *ranging* (comparaison des RSSI) pendant que l'app est vivante — ce
que Q41 garantit. `aisle.beacon_major` devient `aisle.beacon_minor`, et
`parking_lot` gagne `beacon_major`. Le contrat du pont passe de
`startMonitoring(uuid, majors[])` à `startMonitoring(uuid, major)` et
`onAisleEnter(major, ts)` devient `onAisleChanged(minor, ts)`.

**Q41** — Une entrée de région réveille une app terminée pour une dizaine de
secondes ; CoreMotion ne livre ses transitions qu'à une app qui tourne ; la
manœuvre de stationnement dure une à trois minutes. La chaîne « balise → réveil
→ *walking* » avait donc un trou au milieu. Le scan du QR est déjà le moment où
l'app est garantie au premier plan (Q8) : c'est là qu'elle démarre des mises à
jour de localisation en arrière-plan, qui maintiennent le processus vivant
jusqu'à la présomption de place, puis s'arrêtent. Coût : la permission
« Toujours » et l'indicateur bleu pendant deux ou trois minutes. Un usager qui
n'accorde que « Lorsque l'app est active » garde l'entrée, la sortie et la
facturation ; il perd la présomption, et le garde-fou de 30 minutes fait le reste.
La demande de permission se fait avant le premier scan, avec cette explication.

**Conséquence sur l'ordre de construction** : l'étape 4 (module natif) doit
prouver deux choses précises et mesurables — le processus survit trois minutes
après le scan avec l'écran éteint, et le *ranging* distingue deux allées
adjacentes dans un vrai garage. Si l'une des deux échoue, le repli est la
notification différée à la sortie de région du parking, pas une refonte.

## Tour 10 : Entrée et sortie étanches, usagers sans l'app

Tour ouvert sur une comparaison avec le stationnement classique : bouton, billet,
barrière, paiement à la sortie. Question posée : le scan du QR à l'entrée coûte-t-il
du temps, et comment facturer quelqu'un qui n'a pas l'app sans billet, sans
caméra et sans terminal de paiement ? Les billets papier et le terminal ont été
refusés d'emblée.

| # | Décision | Réponse |
|---|----------|---------|
| Q42 | Le QR d'entrée face au billet | Le QR reste ; il coûte 10 s de plus à la barrière et fait gagner 3 à 6 minutes par visite |
| Q43 | Scanner armé par la balise d'entrée | L'app ouvre le scanner d'elle-même quand elle voit la balise de la borne ; à la borne il ne reste que viser et scanner |
| Q44 | Usagers sans l'app | Le QR est une URL : dans l'app, il ouvre le scanner ; dans le navigateur, une page Stripe Checkout avec Apple Pay ou Google Pay |
| Q45 | Sortie de l'usager sans l'app | QR de sortie vers une page qui retrouve la session par un jeton conservé trois fois : cookie, passe Wallet, lien par SMS ou courriel |
| Q46 | Sessions ouvertes sans sortie | Jamais expirées, jamais facturées d'office : après sept jours, vérification physique par l'opérateur |
| Q47 | Contrôleur hors ligne | Entrée refusée, sortie ouverte sans condition, passages comptés localement et rejoués |
| Q48 | Couverture cellulaire aux bornes | Troisième pré-requis d'adhésion, mesuré, à côté du Wi-Fi et de la barrière |
| Q49 | Preuve du temps gagné | Le temps de présence sur la boucle d'armement est mesuré à chaque barrière et affiché au tableau de bord |

**Q42** : Budget temps d'une visite type aux heures de pointe, barrière et passage
compris dans chaque ligne.

| Étape | Stationnement classique | Palier |
|---|---|---|
| Savoir avant de partir que le parking n'est pas plein | Inconnu ; 10 à 20 % de risque d'un panneau « complet » et d'un détour de 5 à 10 min | Connu dans l'app, le hold garantit la place |
| Barrière d'entrée | 9 s (bouton, billet, barrière) | 10 s avec le scanner armé, 15 à 21 s téléphone dans le sac |
| Trouver une place | 2 à 5 min à parcourir les paliers | 1 à 1,5 min directement vers la place assignée |
| Retrouver la voiture | 30 s à 2 min | L'app connaît la place |
| Payer | 1 à 2 min à la caisse, ou 20 à 30 s à la voie de sortie | Aucun geste |
| Barrière de sortie | 8 à 10 s billet en main, 20 à 30 s en payant à la voie | 7 s sans geste, 12 à 18 s avec un tap |
| Total de friction | 5 à 9 min | 1,5 à 2,5 min |

Le temps par usager n'est pas le risque ; la capacité de la voie l'est. Une voie
qui reçoit 300 véhicules à l'heure tourne à 75 % avec un cycle de 9 s et sature
au-delà de 12 s. D'où Q43 : le téléphone se manipule en roulant vers la borne,
pas devant elle.

**Q43** : Quand l'app détecte la balise de la voie d'entrée, elle passe au premier
plan du scanner sans que l'usager touche quoi que ce soit. Déverrouillage et
lancement de l'app se font pendant l'approche. À la borne : viser, scanner, appel
API, ouverture. Un usager qui n'a pas ouvert l'app prend 15 à 21 s ; le hold l'y
incite en amont.

**Q44** : Le jeton signé de la borne est encodé dans une URL. L'app l'intercepte
par lien universel ; un navigateur ouvre une page Stripe Checkout. Apple Pay ou
Google Pay pré-autorise le plafond journalier en une reconnaissance faciale, sans
saisie de carte. La session est créée sans compte, avec `identity_kind = WEB`, le
client Stripe créé par le portefeuille et un jeton de session. Le moyen de paiement
est enregistré pour usage hors session, sinon rien au-delà du plafond ne pourrait
être facturé : c'est un invariant de code, avec un test, pas une option. La page
affiche la place assignée et le guidage. L'usager sans l'app n'a ni disponibilité
avant de partir, ni hold, ni présomption de place, ni sortie sans geste : chaque
manque est une raison d'installer l'app, présentée sur le reçu.

**Q45** : À la sortie, le QR de la borne ouvre la même page, qui retrouve la
session par le jeton, capture sur la pré-autorisation et commande l'ouverture. Le
jeton est conservé trois fois dès l'entrée : cookie de 30 jours, passe Wallet
portant le QR de sortie, lien envoyé par SMS ou courriel si le portefeuille a
partagé une adresse. Le numéro de place seul n'est jamais accepté comme preuve :
n'importe qui le lit au sol et ferait payer la session d'un autre. Si les trois
supports sont perdus, c'est le cas du billet perdu : le personnel.

**Q46** : Une session ne périme pas tant que la voiture est à l'intérieur. Seule
la pré-autorisation a une durée : un plafond journalier, sept jours de validité.
Q39 règle le séjour long qui sort : capture du plafond, différence facturée hors
session. Une session sans sortie après sept jours n'est jamais facturée d'office,
parce qu'elle peut être le résidu d'un passage en talonnage sur une ouverture
annulée : elle apparaît au tableau de bord comme place à vérifier, et l'opérateur
confirme la présence du véhicule ou clôt la session à la dernière preuve connue.

**Q47** : Un contrôleur qui ne joint plus l'API refuse l'entrée, affiche « hors
service », et ouvre la sortie sans condition en comptant localement les passages,
rejoués à la reconnexion. Perdre quelques captures vaut mieux qu'un parking
qui retient ses usagers.

**Q48** : L'usager sans l'app ne rejoindra jamais le Wi-Fi du garage, et l'usager
avec l'app pas toujours. Les deux bornes doivent être couvertes en cellulaire,
mesuré lors de l'adhésion : `parking_lot.cell_verified_at`, au même rang que
`wifi_verified_at` et `gate.verified_at`.

**Q49** : Le tableau de Q42 est une estimation. Le prototype doit produire ses
propres chiffres : le contrôleur horodate l'arrivée sur la boucle d'armement et la
fermeture de la boucle de sécurité, et l'API en tire un temps de présence par
passage. Le tableau de bord affiche la moyenne par voie. La sortie est la preuve
la plus facile : 7 s sans geste contre 20 à 30 s de paiement à la voie se voit au
chronomètre.

**Ce que le tour 10 accepte sans le corriger** : un QR photographié ouvre la
barrière à distance, au prix d'une pré-autorisation que le fraudeur paie ; sans
téléphone, pas d'entrée, ce qui est Q2 ; un téléphone déchargé à la sortie exige
le personnel.

**Conséquences sur le modèle** : `session.user_id` devient nullable, `session`
gagne `identity_kind` (ACCOUNT ou WEB), `web_token` et `stripe_customer_id` ;
`parking_lot` gagne `cell_verified_at` ; `gate_passage` gagne `armed_at` et
`closed_at` pour le temps de présence. Trois endpoints web sans authentification
autre que le jeton de session, une tâche planifiée `flag_stale_sessions`
quotidienne. Plusieurs sessions ouvertes par compte sont permises ; seul le hold
reste unique.

## Décisions prises sans validation explicite

Trois points ont été tranchés en cours de rédaction et méritent une relecture.

1. **Remplissage allée par allée** plutôt que place par place en séquence (Q15).
2. **Garde-fou de 30 minutes** sur les assignations orphelines, malgré le refus du
   TTL en Q10 ; depuis Q36 il présume la place occupée au lieu de la libérer.
3. **La fenêtre de 60 secondes** entre la commande d'ouverture et la fermeture de
   la boucle (Q33) est un ordre de grandeur, pas une mesure ; à ajuster sur le
   terrain.
