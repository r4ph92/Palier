# 015 — Distance calculée sur l'appareil

**Contexte.** #5 trie les stationnements en ligne par distance, à moins de 10 km. Envoyer la position à l'API (`?latitude=…&longitude=…`) l'aurait fait passer par les journaux du serveur et obligé à la couvrir dans l'avis de confidentialité ; le calcul en SQL n'aurait été prouvé que sur la base de la voie (décision 005).

**Décision.**
- **La position ne quitte pas le téléphone.** `GET /v1/lots` ne prend aucun paramètre : il rend, pour chaque parking en ligne, `location` (`{ latitude, longitude }` ou `null`), `freeSpots` et `freeSpotsByCategory`.
- **L'app calcule** la distance (haversine, `lots/distanceBetween`), garde les parkings à 10 km ou moins (`NEARBY_RADIUS_METRES`), du plus proche au plus loin (`lots/nearbyLots`). Un parking sans coordonnées n'apparaît qu'en l'absence de position.
- **Sans position** (refusée, échec de la demande, position introuvable en 5 s) : ordre par nom de l'API, et un avis dit pourquoi.
- **Catégories** : une place compte dans chaque catégorie qu'elle porte, standard = aucun marqueur ; chaque catégorie est plafonnée au total affiché (Q35).

**Conséquences.** L'avis de confidentialité garde sa version : la position n'est ni envoyée ni conservée. Depuis #112, l'API rend **tous** les parkings en ligne, par nom, sans borne ni pagination, pour que le filtre de 10 km reste sur le téléphone : un parking proche n'est jamais écarté à cause de son nom. L'ancienne borne de 50 et son avertissement au journal (#5) sont retirés. `GET /v1/lots` refuse tout paramètre (400 `QUERY_NOT_ALLOWED`, après la session et le consentement), donc aucune position ne l'atteint. Le journal des requêtes de l'API n'écrit que le chemin, jamais la query string, et la réponse 404 ne renvoie pas l'URL : une position envoyée par un client modifié ne laisse aucune trace dans ce journal. Coût : la réponse grandit avec le nombre de parkings en ligne ; si elle devient trop lourde, la piste sera une pagination, pas l'envoi de la position.
