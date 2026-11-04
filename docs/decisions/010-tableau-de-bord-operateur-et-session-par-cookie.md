# 010 — Tableau de bord opérateur : session par cookie, portée des jetons et connexion de test à trois verrous

## Contexte
#62 ouvre le tableau de bord opérateur (`docs/04` : client web, types partagés avec l'API). Un opérateur ne doit voir que ses parkings ; un jeton du tableau de bord ne doit rien ouvrir dans l'API de l'app, ni l'inverse. Google et Apple (#30) viendront plus tard ; d'ici là, seule la connexion de test existe.

## Décision
- Les routes du tableau de bord vivent sous `/v1/dashboard/…` (`me`, `operators`, `lots`, `lots/:id`, `sign-out`, `test/…`) au lieu des chemins de `docs/02` (`/v1/operators/onboarding`, `/v1/lots/{id}/pricing`) : le préfixe délimite la surface de la session opérateur, enregistrée dans sa propre portée Fastify, hors de la version minimale de l'app.
- La session est le même jeton opaque haché que la décision 004, dans `user_session_token` avec une colonne `scope` (`APP` | `DASHBOARD`, enum `session_scope`, `APP` par défaut). Chaque garde filtre sa portée ; le plafond de dix jetons actifs compte par portée. Un jeton `DASHBOARD` dure 12 h.
- Le navigateur porte le jeton dans un cookie `palier_dashboard` `HttpOnly; SameSite=Strict; Path=/v1/dashboard`, `Secure` hors `NODE_ENV=development` : aucun script de la page ne le lit. Toute écriture sous `/v1/dashboard` exige l'en-tête `X-Requested-With: palier-dashboard` (sinon 403 `CSRF_HEADER_MISSING`), qu'un formulaire d'un autre site ne peut pas poser.
- Un utilisateur appartient à au plus un opérateur (`operator_member`, `user_id` unique) ; un parking d'un autre opérateur et un identifiant mal formé répondent le même 404 `LOT_NOT_FOUND`.
- Trois verrous pour « Connexion de test » : l'API n'enregistre `test/users` et `test/sign-in` que si `NODE_ENV` vaut `development` ou `test` ; la page ne l'affiche que dans un build de développement (`import.meta.env.DEV`, le module est absent du build de production) et avec `VITE_TEST_SIGN_IN=true` ; elle ne montre la section que si l'API liste des utilisateurs.
- En développement, Vite relaie `/v1` vers l'API (`API_PORT`) : une seule origine, pas de CORS. Le service en production (fichiers statiques derrière la même origine que l'API) est reporté au déploiement.

## Conséquences
Le filtre SQL par portée et le plafond par portée ne sont vérifiés que par la QA manuelle sur la base de la voie, pas par des tests (décisions 002 et 005) ; les tests unitaires couvrent le même comportement sur un faux dépôt.
