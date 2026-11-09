# 025 — Historique des reçus

**Contexte.** #53 : Julie retrouve ses reçus passés dans « Compte » > « Reçus » pour vérifier ce qu'elle a payé (023 produit le reçu à la sortie).

**Décision.**
- **Routes** : `GET /v1/me/receipts` (liste) et `GET /v1/me/receipts/:sessionId` (détail), derrière le jeton et l'avis de confidentialité comme les autres routes du conducteur. Un reçu est une session `CLOSED_PAID` du conducteur : une session ouverte, annulée, d'un autre conducteur ou inconnue répond 404 `SESSION_NOT_FOUND`, un seul corps pour les quatre.
- **Liste** : `{ receipts: [{ sessionId, lotName, exitedAt, durationMinutes, totalCents }] }`, du plus récent au plus ancien (`exit_at` décroissant), sans pagination : la rétention de 90 jours (Q23, D11) la garde courte.
- **Détail** : le reçu de la sortie (023) plus `sessionId`, `lotName`, `enteredAt` et `cardLast4`. Les chiffres viennent du même `receiptOf` que la sortie, calculés depuis le tarif copié sur la session (011) et `captured_cents` : l'historique ne peut pas contredire le reçu vu à la sortie.
- **Carte** : `parking_session.card_last4` (migration 0023) est écrit à l'entrée, depuis la carte enregistrée du conducteur. Le reçu nomme la carte réellement débitée, même si le conducteur en change ensuite. Une session ouverte avant 0023 n'a pas de carte : `cardLast4` est `null` et l'app n'affiche pas la ligne.
- **App** : bouton « Reçus » dans Compte, liste, puis détail ; on revient de l'un à l'autre par « Retour ».

**Conséquences.** L'anonymisation à 90 jours retire les reçus de l'historique (prouvée en #80, hors de cette carte). Aucun export ni partage de reçu.
