# 027 — Séjour de plus de 24 heures

**Contexte.** #51 (Q39, D10) : la carte ne retient que le plafond journalier à l'entrée (023). Un séjour de plus de 24 heures coûte davantage ; le conducteur ne doit pas être bloqué à la sortie pour autant.

**Décision.**
- **Prix** (`stayLines`, `stayAmount`) : jusqu'à 24 h, inchangé (011). Au-delà, chaque tranche de 24 h écoulée vaut le plafond journalier, puis les minutes restantes se facturent par tranches commencées, plafonnées comme une journée. Avec 0,75 $ par 15 minutes et 25,00 $ de plafond : 30 h = 25,00 $ + 6 h à 18,00 $ = 43,00 $ ; 50 h = 25,00 $ + 25,00 $ + 2 h à 6,00 $ = 56,00 $. `GET /v1/me/session` affiche ce total courant, et l'app ajoute « Plafond de 24 h dépassé — le surplus sera facturé à la sortie » dès que la durée dépasse 24 h.
- **Sortie** (023) : la capture prend `min(autorisation, montant)` comme avant. Le surplus, `montant - capture` quand il est positif, est ensuite chargé hors session sur la carte de l'autorisation d'entrée (`PaymentAuthorizer.chargeSurplus` : l'intention d'entrée donne le client, la carte et le compte de l'opérateur ; clé d'idempotence `exit-extra-<sessionId>`, sans le montant). Il est tenté au tap même si la capture reste en attente (026), et son résultat est écrit avec la fermeture : `surplus_paid_cents` et `unpaid_cents` (migration 0025, défaut 0).
- **Refus du surplus** : la barrière s'ouvre quand même (Q38). Le surplus refusé, ou Stripe injoignable à ce moment, devient `unpaid_cents`, sans relance ni blocage d'une entrée suivante. #72 lit ce montant pour la timeline de l'opérateur ; l'affichage côté opérateur n'est pas dans cette carte.
- **Reçu** : `ExitReceipt` gagne `lines` (`DAY` avec son numéro, `EXTRA` avec ses minutes) et `unpaidCents`. `lines` est vide pour un séjour de 24 h ou moins (reçu inchangé). `totalCents` est ce qui a été payé : la capture plus le surplus accepté ; le solde impayé n'y est pas. Sortie et historique (025) partagent `receiptOf`, et l'historique reste sur les sessions `CLOSED_PAID`. L'app affiche « 24 premières heures : 25,00 $ (plafond) », « 24 heures suivantes… », « 6 h supplémentaires : 18,00 $ », « Total », puis « Solde impayé ».
- **Simulation** : `PAYMENTS_SIMULATION=surplus-declined` (développement et test, refusé avec une clé Stripe) : holds et captures réussissent, le surplus est refusé.

**Conséquences.** Limites connues :
- L'autorisation Stripe expire après 7 jours (026) : le plafond d'un séjour plus long ne se capture plus et reste en attente ; le surplus, hors autorisation, est quand même chargé. Aucun repli (charger le total hors session) n'existe.
- Le solde impayé n'est ni relancé ni signalé au conducteur après le reçu, et ne bloque pas l'entrée suivante.
- La clé du surplus ne dépend pas du montant, pour ne jamais charger deux fois : un second tap qui demanderait un autre montant après un premier surplus déjà pris (fermeture refusée par `LOT_BUSY`) est refusé par Stripe et se lit « impayé » alors que le premier montant est pris.
- Un surplus chargé alors que la capture reste en attente se retrouve sur le reçu seulement à la reprise (026).
