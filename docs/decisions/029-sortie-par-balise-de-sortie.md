# 029 — Sortie par la balise de sortie

**Contexte.** #49 (Q34, étape 2) : sans lecteur, le conducteur sort sans geste quand son app voit la balise de la voie de sortie et que son véhicule est à la barrière. Les deux signaux sont nécessaires : la balise seule ouvrirait pour un piéton qui passe avec l'app, le véhicule seul ne dit pas lequel des conducteurs part.

**Décision.**
- **Rapport de l'app** : `POST /v1/entries/:sessionId/exit-beacon`, corps `{ major }`, jeton du conducteur comme les autres routes de la session. 204 sans corps ; 404 `SESSION_NOT_FOUND` pour la session d'un autre ; 409 `ENTRY_NOT_CONFIRMED`, `SESSION_CLOSED` ou `BEACON_NOT_THIS_LOT` (le `major` n'est pas celui du parking de la session) ; 503 `PAYMENTS_UNAVAILABLE` sans Stripe. L'app l'envoie quand le module signale la voie de sortie (minor 0), au plus une fois par 15 s.
- **Présence du véhicule** : `POST /v1/gates/:id/presence`, sans corps, clé d'appareil de la barrière de sortie (comme `/passage`). 200 `{ outcome: 'waiting' | 'opened' | 'fallback' }` ; 403 `GATE_FORBIDDEN` si la clé n'est pas celle de `:id`, 409 `GATE_NOT_EXIT` pour une barrière d'entrée, 401 pour une clé inconnue ou révoquée. La console de démo l'envoie par « Véhicule à la sortie ».
- **Deux tables** (migration 0029) : `exit_beacon_report` (une ligne par session, un nouveau rapport rafraîchit l'heure) et `exit_vehicle_presence` (une ligne par barrière). Les heures sont celles de Postgres, comme la fenêtre d'ouverture (024).
- **Décision** (`settleBeaconExit`), appelée par le second des deux signaux, quel que soit l'ordre : les sessions du parking qui n'ont pas quitté et ont rapporté la balise depuis moins de 60 s sont les candidates (`EXIT_BEACON_WINDOW_SECONDS`).
  - Aucune candidate, ou aucune présence de moins de 60 s : rien ne se passe, le signal reçu attend l'autre.
  - Une candidate : la présence est dépensée (un `delete` qui décide, donc deux requêtes en même temps n'ouvrent qu'une fois), puis `payAndClose` (023, 026) avec `exit_identification = 'BEACON'` pour la barrière de sortie du parking. Capture, fermeture, places libérées, commande `OPEN` et reçu sont ceux du tap.
  - Deux candidates : la présence est dépensée et rien n'est capturé ni ouvert (repli sur le tap, jamais une ouverture sur un signal incertain).
- **Repli visible** : `GET /v1/me/session` ajoute `exitBeaconFallback`, vrai quand la session a rapporté la balise et qu'au moins une autre session du parking l'a fait, toutes deux depuis moins de 60 s (calculé à la lecture, rien n'est stocké). L'app lit `false` si le champ manque, et affiche « Touchez « Ouvrir » pour sortir » (EN « Tap "Open" to leave ») au-dessus du bouton.
- **L'app apprend l'ouverture en lisant sa session** : après un rapport, elle relit la session toutes les 4 s pendant 60 s. Quand la session n'existe plus, elle lit le reçu (025) et l'affiche sans tap ; s'il n'est pas lisible, l'écran « Barrière ouverte — votre reçu suivra » prend le relais.

**Conséquences.** Limites connues :
- Le serveur ne peut pas vérifier que l'app a vraiment vu la balise : le `major` écarte l'erreur honnête (la balise d'un autre parking), pas un client modifié. Un faux rapport ne suffit pas : il faut aussi un véhicule à la barrière, et deux rapports font replier sur le tap. Le pire cas est une sortie un peu plus tôt de la propre session de ce conducteur, facturée normalement.
- Une session qui rapporte la balise puis dont le véhicule n'arrive jamais ne coûte rien : le rapport expire seul.
- La présence est dépensée aussi quand deux conducteurs sont candidats : le conducteur qui touche « Ouvrir » sort normalement, et un véhicule qui reste devant la barrière demande un nouvel appui de la console.
- Si Stripe ou la barrière ne peuvent pas suivre, la présence est déjà dépensée : le conducteur garde le tap (la capture en attente de 026 s'applique, elle, comme au tap).
- Une session dont le reçu n'est pas encore lisible quand elle disparaît peut aussi disparaître pour une autre raison : l'écran d'attente reste alors jusqu'à « Terminé » (un cas qui ne vaut qu'une minute après un rapport).
- Un seul portail de sortie par parking (OQ12) : la barrière qui s'ouvre est la première par nom.
- La lecture des candidates et la dépense de la présence sont deux requêtes sans verrou du parking : un rapport d'un second conducteur validé entre les deux laisse le premier sortir seul. C'est la même ambiguïté que celle acceptée plus haut (le véhicule ne dit pas quel conducteur il est).
- Un client modifié qui connaît le `major` du parking peut rapporter la balise de n'importe où et forcer le repli sur le tap pour tous, aussi longtemps qu'il rafraîchit son rapport : un déni de la fonction, jamais une perte d'argent. Aucune limite par session pour l'instant.
