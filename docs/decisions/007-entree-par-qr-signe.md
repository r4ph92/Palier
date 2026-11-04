# 007 — Entrée par QR signé, session créée avant l'autorisation

**Contexte.** La borne d'entrée affiche un QR unique (Q8) ; le scanner attribue
une place, pré-autorise le plafond journalier et ouvre la barrière (`docs/03`).
Le dossier ne dit ni ce que le QR contient, ni comment le vérifier, ni comment
défaire une entrée qui échoue à mi-chemin.

**Décision.**
- **Contenu du QR** : une URL (Q44), `https://palier.app/q/palier1.<gateId>.<signature>`,
  où `signature = base64url(HMAC-SHA256(gate.qr_secret, "palier1.<gateId>"))`
  (43 caractères). L'API accepte l'URL ou le jeton seul (`QR_LINK_PREFIX` dans
  `packages/shared-types/src/entryLink.ts`) ; #45 rouvrira le même lien depuis la
  caméra. Le jeton est vérifié par une expression stricte avant toute lecture en
  base, puis comparé à temps constant (`timingSafeEqual` après contrôle de
  longueur). Jeton mal formé, barrière inconnue, barrière sans secret ou
  signature fausse donnent la même réponse, `QR_NOT_RECOGNIZED`.
- **QR statique et rejouable**, comme le tour 10 l'accepte : une photo du QR
  ouvre la barrière à distance, au prix d'une pré-autorisation payée par le
  fraudeur. Changer `gate.qr_secret` invalide les QR imprimés de cette borne.
- **Ordre des contrôles**, sans aucune écriture : jeton → sens de la barrière →
  parking en ligne → intégration `SIMULATED` → opérateur payable (ou mode démo)
  → plaque et carte du conducteur.
- **Ordre des écritures** : place et session dans une seule transaction
  (`UPDATE spot … FOR UPDATE OF s SKIP LOCKED`, première place libre par palier,
  allée et numéro), puis la pré-autorisation Stripe hors transaction, puis la
  commande d'ouverture. **Écart assumé avec `docs/03`** : la session existe avant
  l'autorisation, pour que la clé d'idempotence (`entry-<sessionId>`) et la
  métadonnée `sessionId` de l'intention Stripe désignent une ligne réelle ;
  `payment_intent_id` est écrit juste après l'autorisation.
- **Compensation** : un refus de carte annule la session et libère la place ;
  un échec de la commande d'ouverture libère d'abord la place en base, puis
  annule l'intention. Chaque étape d'annulation est gardée : son échec est
  journalisé, l'étape suivante s'exécute quand même et le conducteur reçoit
  l'erreur d'origine (une autorisation non annulée expire d'elle-même chez Stripe).
- **Une seule session active par conducteur et par place**, garanti par deux
  index uniques partiels sur `parking_session` avec une liste explicite d'états
  actifs : `state IN ('CREATED')` aujourd'hui. Chaque story qui ajoute un état
  actif (entrée confirmée, sortie…) l'ajoute aussi à ces deux prédicats. La
  violation de l'index par conducteur devient `409 ALREADY_INSIDE`.
- **Barrière simulée** (D5) : la commande est une ligne `gate_command`, que la
  console de démonstration lit chaque seconde par `GET /v1/gates/me/commands`.
  Toute autre intégration est refusée en `GATE_UNAVAILABLE` avant toute écriture.
- **Compte de l'opérateur** : sans `stripe_account_id`, l'entrée est refusée
  (`OPERATOR_NOT_PAYABLE`), sauf en mode démo où l'intention reste sur la
  plateforme avec un avertissement au journal.

**Conséquences.** Un arrêt du serveur entre deux étapes laisse une place
`ASSIGNED` et une autorisation non capturée jusqu'au balayage de #39. La place
B-5 (accessible) reste attribuable : les filtres arrivent avec #43 et #44.
