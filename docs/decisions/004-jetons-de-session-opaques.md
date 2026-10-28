# 004 — Jetons de session opaques, hachés en base, et connexion de test à double verrou

**Contexte.** #29 demande qu'un testeur se connecte comme un conducteur du seed, reste connecté après un redémarrage de l'app, et que son jeton soit refusé dès qu'il se déconnecte. La connexion de test ne doit exister ni dans l'app ni dans l'API d'une configuration de production. Apple et Google (#30) viendront s'ajouter au même mécanisme de jeton.

**Décision.**
- Le jeton est une valeur aléatoire opaque de 32 octets (base64url), pas un JWT. La table `user_session_token` n'en garde que le SHA-256 ; la déconnexion remplit `revoked_at`, et toute requête avec ce jeton reçoit 401. Un JWT aurait demandé une liste de révocation pour obtenir le même refus immédiat.
- L'app range le jeton dans le trousseau iOS (`expo-secure-store`), jamais en clair, et le relit au lancement avec `GET /v1/me`.
- Deux verrous indépendants pour la connexion de test : l'API n'enregistre `GET /v1/test/drivers` et `POST /v1/test/sign-in` que si `NODE_ENV` vaut `development` ou `test` (sinon 404, comme une route inconnue ; un `NODE_ENV` absent compte comme production) ; l'app n'affiche « Connexion de test » que si le build porte `EXPO_PUBLIC_TEST_SIGN_IN=true`. Le verrou de l'API seul laisserait un bouton mort dans l'app de production ; celui de l'app seul laisserait la route ouverte sur un serveur de production.

**Conséquences.** Une base volée ne livre aucun jeton utilisable. Chaque appareil a son propre jeton ; se déconnecter sur l'un ne déconnecte pas l'autre. Les jetons n'expirent pas encore : une durée de vie viendra avec Apple et Google (#30) si le besoin se confirme. La déconnexion dans l'app est immédiate même hors ligne ; le jeton n'est alors révoqué côté serveur que si l'appel aboutit.
