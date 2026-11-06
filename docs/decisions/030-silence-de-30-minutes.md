# 030 — Silence de 30 minutes

**Contexte.** #24 : un téléphone mort n'envoie jamais de passage à pied, et la place ne doit pas être rendue pour autant (Q36 : le silence présume, il ne libère jamais). Le compteur de véhicules borne l'erreur cumulée (#71).

**Décision.**
- **Tâche** `presumeSilentSessions`, toutes les 300 s (`SILENT_SESSION_CHECK_PERIOD_SECONDS`), même forme que l'expiration des garanties (016) : une lecture de l'horloge, les parkings concernés sans verrou, puis une transaction par parking sous le verrou, délai borné ; un parking occupé attend le passage suivant. Les 30 minutes sont une constante du domaine (`SILENCE_BEFORE_PRESUMPTION_MILLISECONDS`), pas un réglage.
- **Entrée sans signal** : `ENTRY_CONFIRMED` avec `entry_confirmed_at <= now − 30 min` passe `PARKED_PRESUMED`, `parked_at = now`. **Question sans réponse** : `PARKED_UNCONFIRMED` avec `parked_at <= now − 30 min` passe `PARKED_PRESUMED`, `parked_at` garde l'heure de la question. Aucune place n'est écrite : `OCCUPIED` reste `OCCUPIED`, `OCCUPIED_UNKNOWN` reste à vérifier. À 29 minutes, rien ne change ; `CREATED` et `CANCELLED` ne correspondent jamais.
- **Preuve gardée** : migration 0030, enum `parking_session_presumption` (`WALK`, `TIMEOUT`) et colonne `presumed_by`, remplie à `WALK` pour les sessions déjà présumées, avec `CHECK` : toute session `PARKED_PRESUMED` a une preuve. La correction vers `PARKED_CONFIRMED` laisse la colonne en historique. L'API et l'app ne l'exposent pas.
- **Concurrence** : chaque `UPDATE` revérifie l'état ; un passage à pied ou une réponse arrivés avant gagnent, la tâche ne trouve plus rien.

**Conséquences.** Avec l'horloge de test (`PUT /v1/test/clock`) la tâche voit le temps déplacé, les écritures du passage à pied gardent `now()` de la base (écart déjà connu). Une session présumée à tort se corrige comme avant (021).
