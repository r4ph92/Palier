# 039 — Bornes, clés d'appareil et QR imprimables

**Contexte.** #67 : l'opérateur ajoute ses bornes depuis le tableau de bord, reçoit la clé d'appareil de chacune et imprime son QR, sans passer par le seed.

**Décision.**
- **Routes** sous `/v1/dashboard/lots/:id/gates` : `GET` (réglages, jamais de secret), `POST` 201 `{ gateId, deviceKey, lotGates }`, `PUT /:gateId` avec tous les réglages (nom, raccordement, adresse, boucles, identification à la sortie) ; le sens est fixé à l'ajout et une clé `kind` envoyée au `PUT` est ignorée. `POST /:gateId/device-key`, `POST /:gateId/qr-secret` (204) et `GET /:gateId/qr-link`. Règle partagée : `@palier/shared-types/gateDraft`, adresse `https` seulement, sans identifiants ni caractère invisible.
- **Limites**, comptées sous le verrou du parking : une seule borne de sortie par parking (`GATE_EXIT_LIMIT` 409, le flux de sortie n'en connaît qu'une), 50 bornes au plus (`GATE_LIMIT_REACHED` 409).
- **Clé d'appareil** : 32 octets aléatoires, montrée une fois (réponse `Cache-Control: no-store`), seule son empreinte SHA-256 est gardée ; régénérer révoque toutes les clés vivantes de la borne dans la même transaction. **Secret du QR** : régénéré sous le verrou ; une borne sans secret utilisable en reçoit un au premier QR demandé. Aucun secret dans une URL, un refus ou un journal.
- **Feuille imprimable** : un fichier HTML autonome, téléchargé par un `Blob` (aucune route d'impression), QR encodé sans dépendance réseau (`uqr`, correction M, zone calme de 4 modules, 80 mm), noir sur blanc, textes en français puis en anglais ; les noms sont échappés par React. Le fichier porte ses deux polices en base64, sous-ensemble latin (OFL 1.1, licences dans `apps/dashboard/src/gates/sheetFonts/`) : Archivo 600 découpé avec `pyftsubset` dans le TTF déjà utilisé par le tableau de bord (`@expo-google-fonts/archivo` 0.4.2) ; IBM Plex Mono 500 pris tel quel dans la version officielle d'IBM (`@ibm/plex-mono` 1.1.0, `IBMPlexMono-Medium-Latin1.woff2`), car « Plex » est un nom réservé qu'un sous-ensemble fait maison ne pourrait pas garder. Le module de la feuille n'est chargé qu'à la première impression.
- Le QR d'une sortie n'est qu'un lien signé vérifié par `gateToken` : la sortie par scan vient avec #57.

**Hors portée.** Caméra de l'app (#45, #55, #57, OQ2). Les adresses privées (SSRF) seront refusées quand les adaptateurs de contrôle d'accès appelleront ces adresses.

**À ne pas faire.** Ne pas régénérer la clé ni le secret d'Entrée Démo et Sortie Démo dans une base partagée : la console et les QR de `docs/demo-console.md` cesseraient de fonctionner.
