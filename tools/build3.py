# -*- coding: utf-8 -*-
import io, os
from seq import build

E, A, P, D, S = "ext", "app", "api", "db", "svc"

# ---------- A : entree ----------
pa = [("Conducteur","",E),("App mobile","React Native",A),("API","",P),
      ("Base de données","Postgres",D),("Stripe","",S),
      ("Contrôleur","barrière d'entrée",E),("Caméra d'entrée","ANPR",E)]
ma = [
 (0,1,"scan du QR de la borne","msg"),
 (1,2,"POST /v1/entries { gate_token }","msg"),
 (2,2,"vérifie la signature HMAC du jeton","self"),
 (2,3,"UPDATE spot ... FOR UPDATE SKIP LOCKED","msg"),
 (3,2,"place 2-12 → ASSIGNED","ret"),
 (2,4,"PaymentIntent · capture manuelle · plafond journalier","msg"),
 (4,2,"requires_capture","ret"),
 (2,3,"INSERT session → CREATED","msg"),
 (2,5,"ouvrir la barrière","msg"),
 (2,1,"place 2-12 · palier 2 · allée B","ret"),
 (1,0,"affiche la place · arme le suivi de balises","msg"),
 (6,2,"POST /v1/gates/{id}/plate { plaque }","msg"),
 (2,3,"session → ENTRY_CONFIRMED","msg"),
 (2,3,"plate_mismatch = true","msg"),
 (2,1,"avertissement : la sortie devra passer par le QR","ret"),
 (2,3,"session → CANCELLED · place → AVAILABLE","msg"),
 (2,4,"annulation de la pré-autorisation","msg"),
]
fa = [("alt",11,16,[(13,"[ plaque lue mais différente du compte ]"),
                    (15,"[ aucune plaque lue après 2 min ]")],
       "[ plaque lue et conforme ]")]

# ---------- B : confirmation ----------
pb = [("Balise BLE","allée B",E),("iOS","CoreLocation · CoreMotion",E),
      ("App mobile","",A),("API","",P),("Base de données","Postgres",D),
      ("APNs","",S),("Conducteur","",E)]
mb = [
 (0,1,"entrée dans la région · major = allée B","msg"),
 (1,2,"réveil de l'app en arrière-plan","msg"),
 (2,1,"démarrer le suivi d'activité","msg"),
 (1,2,"automotive → walking · confiance élevée","ret"),
 (2,3,"POST /v1/sessions/{id}/walking","msg"),
 (3,4,"walking_at = now()","msg"),
 (3,5,"« Confirmez la place 2-12 »","msg"),
 (5,6,"notification sur l'écran verrouillé","msg"),
 (6,2,"tap « Confirmer »","msg"),
 (2,3,"POST /v1/sessions/{id}/parked { }","msg"),
 (3,4,"session PARKED_CONFIRMED · 2-12 → OCCUPIED","msg"),
 (6,2,"saisit « 2-15 »","msg"),
 (2,3,"POST /v1/sessions/{id}/parked { spot_id: 2-15 }","msg"),
 (3,4,"TX : 2-15 → OCCUPIED · 2-12 → OCCUPIED_UNKNOWN","msg"),
 (3,4,"session PARKED_UNCONFIRMED · 2-12 → OCCUPIED_UNKNOWN","msg"),
]
fb = [("alt",8,14,[(11,"[ l'utilisateur corrige le numéro ]"),
                   (14,"[ aucune réponse ]")],
       "[ l'utilisateur confirme ]")]

# ---------- C : sortie ----------
pc = [("Caméra de sortie","ANPR",E),("API","",P),("Base de données","Postgres",D),
      ("Stripe","",S),("Contrôleur","barrière de sortie",E),
      ("App mobile","",A),("Conducteur","",E)]
mc = [
 (0,1,"POST /v1/gates/{id}/plate { plaque }","msg"),
 (1,2,"session active pour cette plaque dans ce parking","msg"),
 (2,1,"session #4A7 · entrée 18 h 02 · place 2-15","ret"),
 (1,1,"calcule la durée et le montant selon la politique","self"),
 (1,3,"capture sur la pré-autorisation existante","msg"),
 (3,1,"succeeded · 9,75 $","ret"),
 (1,2,"session CLOSED_PAID · place → AVAILABLE","msg"),
 (1,4,"ouvrir la barrière","msg"),
 (1,5,"reçu","msg"),
 (5,6,"affiche le reçu et le détail du calcul","msg"),
 (6,5,"scanne le QR de la borne de sortie","msg"),
 (5,1,"POST /v1/sessions/{id}/exit { gate_token }","msg"),
 (1,1,"reprend au calcul du montant","self"),
]
fc = [("alt",10,12,[],"[ repli : plaque illisible ou plate_mismatch ]")]

# ---------- D : onboarding opérateur ----------
pd = [("Opérateur","",E),("Tableau de bord","web",A),("API","",P),
      ("Stripe Connect","",S),("Base de données","Postgres",D)]
md = [
 (0,1,"crée un parking","msg"),
 (1,2,"POST /v1/operators/onboarding","msg"),
 (2,3,"créer un compte Express","msg"),
 (3,2,"acct_1Q...","ret"),
 (2,4,"INSERT operator · kyc_status = pending","msg"),
 (2,1,"lien d'onboarding hébergé","ret"),
 (1,0,"redirection vers Stripe","msg"),
 (0,3,"vérification d'identité sur la page hébergée","msg"),
 (3,2,"webhook account.updated","msg"),
 (2,4,"kyc_status = vérified","msg"),
 (0,1,"saisit la politique tarifaire et le plan des places","msg"),
 (1,2,"PUT /v1/lots/{id}/pricing · PUT /v1/lots/{id}/map","msg"),
 (2,2,"refuse si le plafond journalier est absent","self"),
 (2,4,"parking mis en ligne si wifi_vérified_at est renseigné","msg"),
]

svgs = {
 "A": build(pa, ma, fa, "Séquence d'entrée"),
 "B": build(pb, mb, fb, "Séquence de confirmation de place"),
 "C": build(pc, mc, fc, "Séquence de sortie et de facturation"),
 "D": build(pd, md, (), "Séquence d'onboarding d'un opérateur"),
}
for k, v in svgs.items():
    open("out/seq_%s.svg" % k, "w").write(v)
print({k: len(v) for k, v in svgs.items()})
