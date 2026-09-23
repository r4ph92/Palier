# -*- coding: utf-8 -*-
import io, os
from seq import build

E, A, P, D, S = "ext", "app", "api", "db", "svc"

# ---------- A : entree ----------
pa = [("Conducteur","",E),("App mobile","React Native",A),("API","",P),
      ("Base de données","Postgres",D),("Stripe","",S),
      ("Contrôleur","barrière d'entrée",E),("Boucle d'entrée","contact du contrôleur",E)]
ma = [
 (0,1,"scan du QR de la borne · scanner armé par la balise","msg"),
 (1,2,"POST /v1/entries { gate_token }","msg"),
 (1,4,"Apple Pay · Checkout · carte enregistrée hors session","msg"),
 (4,1,"client Stripe","ret"),
 (1,2,"POST /v1/web/entries { gate_token, customer }","msg"),
 (2,2,"vérifie la signature HMAC du jeton","self"),
 (2,3,"UPDATE spot ... FOR UPDATE SKIP LOCKED","msg"),
 (3,2,"place 2-12 → ASSIGNED","ret"),
 (2,4,"PaymentIntent · capture manuelle · plafond journalier","msg"),
 (4,2,"requires_capture","ret"),
 (2,3,"INSERT session → CREATED","msg"),
 (2,5,"ouvrir la barrière","msg"),
 (2,1,"place 2-12 · palier 2 · allée B","ret"),
 (1,0,"affiche la place · arme le suivi de balises","msg"),
 (6,2,"POST /v1/gates/{id}/passage { armed_at, closed_at }","msg"),
 (2,3,"session → ENTRY_CONFIRMED · vehicle_count + 1","msg"),
 (2,3,"session → CANCELLED · place → AVAILABLE","msg"),
 (2,4,"annulation de la pré-autorisation","msg"),
]
fa = [("alt",1,4,[(2,"[ navigateur, sans compte ]")],"[ app ]"),
      ("alt",14,17,[(16,"[ aucun passage en 60 s ]")],
       "[ la boucle se ferme après l'ouverture ]")]

# ---------- B : confirmation ----------
pb = [("Balise BLE","allée B",E),("iOS","CoreLocation · CoreMotion",E),
      ("App mobile","",A),("API","",P),("Base de données","Postgres",D),
      ("APNs","",S),("Conducteur","",E)]
mb = [
 (0,1,"ranging · allée B la plus proche (minor 2)","msg"),
 (1,2,"app déjà vivante : localisation en arrière-plan depuis le scan","msg"),
 (2,1,"démarrer le suivi d'activité","msg"),
 (1,2,"automotive → walking · confiance élevée","ret"),
 (2,3,"POST /v1/sessions/{id}/walking { aisle_minor: 2 }","msg"),
 (3,4,"walking_at = now() · session PARKED_PRESUMED · 2-12 → OCCUPIED","msg"),
 (3,2,"rien à faire","ret"),
 (3,4,"2-12 → OCCUPIED_UNKNOWN · needs_check","msg"),
 (3,5,"« Où êtes-vous garé ? »","msg"),
 (5,6,"notification sur l'écran verrouillé","msg"),
 (6,2,"saisit « 3-04 »","msg"),
 (2,3,"POST /v1/sessions/{id}/parked { spot_id: 3-04 }","msg"),
 (3,4,"TX : 3-04 → OCCUPIED · session PARKED_CONFIRMED","msg"),
 (6,2,"tap « Place prise » avant de se garer","msg"),
 (2,3,"POST /v1/sessions/{id}/spot-taken","msg"),
 (3,4,"TX : 2-12 → OCCUPIED_UNKNOWN · 2-14 → ASSIGNED","msg"),
 (3,2,"nouvelle place 2-14","ret"),
]
fb = [("alt",5,16,[(8,"[ l'allée détectée n'est pas l'allée assignée ]"),
                   (14,"[ la place assignée est prise ]")],
       "[ allée détectée = allée assignée — cas nominal ]")]

# ---------- C : sortie ----------
pc = [("Contrôleur de sortie","boucles · QR de sortie",E),("API","",P),
      ("Base de données","Postgres",D),("Stripe","",S),
      ("App ou page web","",A),("Conducteur","",E)]
mc = [
 (0,1,"POST /v1/gates/{id}/presence — véhicule sur la boucle d'armement","msg"),
 (0,1,"POST /v1/gates/{id}/identify { plaque ou transpondeur }","msg"),
 (4,1,"POST /v1/sessions/{id}/at-exit — balise de sortie vue","msg"),
 (1,1,"une seule session candidate ? sinon repli","self"),
 (5,4,"scan du QR de sortie","msg"),
 (4,1,"POST /v1/sessions/{id}/exit  ·  POST /v1/web/sessions/{token}/exit","msg"),
 (1,2,"session active identifiée dans ce parking","msg"),
 (2,1,"session #4A7 · entrée 18 h 02 · place 2-15","ret"),
 (1,1,"calcule la durée et le montant selon la politique","self"),
 (1,3,"capture sur la pré-autorisation existante","msg"),
 (3,1,"succeeded · 9,75 $","ret"),
 (1,2,"session CLOSED_PAID · place → AVAILABLE","msg"),
 (1,0,"ouvrir la barrière","msg"),
 (0,1,"POST /v1/gates/{id}/passage — boucle fermée","msg"),
 (1,2,"exit_passage_at · vehicle_count − 1","msg"),
 (1,4,"reçu","msg"),
 (4,5,"affiche le reçu et le détail du calcul","msg"),
]
fc = [("alt",1,5,[(2,"[ sinon : balise de sortie vue par une seule app ]"),
                  (4,"[ repli : QR de sortie, app ou page web retrouvée par son jeton ]")],
       "[ opérateur équipé d'ANPR ou de transpondeurs ]")]

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
