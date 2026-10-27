# Direction visuelle de l'app mobile

**Statut : provisoire.** Aucune direction n'avait été choisie avant le premier
écran (story #4). Celle-ci reprend l'identité déjà présente dans le dossier de
conception (`docs/*.html`) pour que l'app et le dossier se ressemblent. À
confirmer ou remplacer avant les écrans suivants ; tout est dans
`apps/mobile/src/theme/`.

**Intention** : un relevé de terrain sobre, lisible d'un coup d'œil avant de
partir, où le chiffre des places libres est l'information principale.

## Jetons

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `canvas` | `#F8F9F6` | `#121513` | Fond d'écran |
| `sunken` | `#E4E6E0` | `#242925` | Squelettes de chargement |
| `ink` | `#191C1A` | `#E7EAE4` | Texte, bouton principal |
| `muted` | `#4B534D` | `#AEB6AE` | Texte secondaire, surtitres |
| `line` | `#D2D6CE` | `#2C322D` | Filets entre les lignes (décoratif) |
| `free` | `#2E7D4F` | `#63B487` | Carré « places libres » (jamais en texte sur fond clair : 4,3:1) |
| `danger` | `#9C3A2A` | `#D9705E` | Carré « complet » |

Polices : **Archivo** (texte, titres en 600) et **IBM Plex Mono** (surtitres et
chiffres, `tabular-nums`), embarquées par `@expo-google-fonts`. Espacement sur
une grille de 4 (4, 8, 16, 24, 40). Cibles tactiles d'au moins 44 pt.
Contrastes vérifiés : `ink` 16:1 et `muted` 7,5:1 sur `canvas` en clair ;
8:1 et plus en sombre.

## Gestes signatures

1. Surtitre en mono, majuscules, interlettrage large, couleur `muted`, au-dessus du titre de chaque écran.
2. Titre d'écran souligné d'un filet `ink` de 2 pt ; les lignes de liste sont séparées par des filets fins `line`, sans cartes ni ombres.
3. Tout chiffre (places, montants à venir) en IBM Plex Mono, chiffres tabulaires.
4. Un état se montre par un carré plein de 8 pt dans la couleur sémantique suivi du mot, jamais par une pastille colorée.
5. Une seule action principale par vue : bouton plein `ink`, angles droits, libellé en Archivo 600.
