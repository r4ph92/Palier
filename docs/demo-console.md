# Console de démonstration

La console joue le contrôleur d'une barrière et ses boucles (D13). Chaque
bouton envoie un vrai passage à l'API, qui met à jour le compteur de véhicules
du parking ; l'app affiche ensuite les places libres recalculées.

## Activer le mode démo

La console n'existe que si `DEMO_MODE=true` dans la configuration de l'API
(`apps/api/.env`, déjà présent dans `.env.example`). Toute autre valeur que
`true` ou `false` empêche le serveur de démarrer. Au démarrage en mode démo,
l'API journalise un avertissement. Sans mode démo, `/demo/console` répond 404.

```
npm run start --workspace @palier/api       # avec DEMO_MODE=true dans apps/api/.env
open http://localhost:3000/demo/console
```

## Clés d'appareil semées

Clés de développement seulement (`apps/api/src/seed/fixtures/gates.ts`) ; la
base n'en garde que l'empreinte SHA-256. `npm run seed --workspace @palier/api`
les recrée et remet le compteur à 0.

| Barrière | Parking | Sens | Clé |
|---|---|---|---|
| Entrée Démo | Parking Démo | entrée | `gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as` |
| Sortie Démo | Parking Démo | sortie | `Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw` |
| Entrée Roy | Garage Roy (hors ligne) | entrée | `qwWc90SgLYX15MzN2UBX8lSQA-hKBlaqbIG9v--98tM` |
| Entrée Démo, clé **révoquée** | Parking Démo | entrée | `L-xYpKfzUH4NHKxi_r6EKJbBXOIiYvhbawTSt34sgRs` |

## Utiliser la console

1. Coller une clé dans « Clé d'appareil ». La clé ne quitte jamais la page :
   ni URL, ni stockage du navigateur.
2. Appuyer sur « Boucle d'entrée fermée » ou « Boucle de sortie fermée ». Au
   premier appui, la console identifie la barrière (`GET /v1/gates/me`), affiche
   son nom, son sens et son parking, puis désactive le bouton de l'autre sens.
3. Chaque passage enregistré s'ajoute à la liste avec son heure et le nombre de
   véhicules dans le parking. Tirer la liste de l'app vers le bas pour voir les
   places libres.

Messages : « Clé d'appareil refusée » (clé inconnue, mal formée ou révoquée),
« Accès refusé pour cette barrière » (403), « Cette barrière n'a pas de
boucles. » (409), « Impossible de joindre Palier. » (API arrêtée). Le bouton
« English » passe toute la page en anglais.

## Scénarios

- **Entrée** : clé d'Entrée Démo, une entrée : l'app passe de 10 à 9 places libres.
- **Sortie** : clé de Sortie Démo, une sortie : retour à 10.
- **Complet** : 10 entrées : l'app affiche « Complet ». 12 entrées : toujours
  « Complet », jamais de nombre négatif (places affichées =
  `min(capacité − véhicules, places libres)`, plancher 0).
- **Clé refusée** : une clé quelconque ou la clé révoquée : « Clé d'appareil
  refusée », le compteur ne bouge pas.
- **Mauvaise barrière** (la console poste toujours vers sa propre barrière, donc
  par curl) :

  ```
  curl -i -X POST http://localhost:3000/v1/gates/00000000-0000-4000-8000-000000000502/passage \
    -H 'authorization: Bearer gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as' \
    -H 'content-type: application/json' -d '{"closedAt":"2026-10-27T22:02:00Z"}'
  ```

  Réponse 403 `GATE_FORBIDDEN`, compteur inchangé.

## API utilisée

- `GET /v1/gates/me` : `{ id, name, kind, lotName }` de la barrière de la clé.
- `POST /v1/gates/:id/passage`, corps `{ "closedAt": "<ISO 8601>" }` :
  `{ gateId, lotId, kind, closedAt, vehicleCount }`. Le sens et le parking
  viennent de la barrière, jamais du corps. `closedAt` à plus de 5 minutes dans
  le futur : 400.
- Authentification : `Authorization: Bearer <clé>` (32 octets en base64url,
  43 caractères). Toute clé absente, mal formée, inconnue ou révoquée reçoit le
  même 401 avec `WWW-Authenticate: Bearer`, avant toute lecture du corps.
