# -*- coding: utf-8 -*-
import io

def band(x, y, w, h, label, sub, cls="bd"):
    o = []
    o.append('<rect class="%s" x="%d" y="%d" width="%d" height="%d" rx="4"/>' % (cls, x, y, w, h))
    o.append('<text class="t-band" x="%d" y="%d">%s</text>' % (x + 18, y + 26, label))
    if sub:
        o.append('<text class="t-band-s" x="%d" y="%d">%s</text>' % (x + 18, y + 43, sub))
    return "\n".join(o)

def boxes(items, x0, y, w, pitch, h=74, cls="cmp"):
    o = []
    for i, (name, sub) in enumerate(items):
        x = x0 + i * pitch
        o.append('<rect class="%s" x="%d" y="%d" width="%d" height="%d" rx="3"/>' % (cls, x, y, w, h))
        o.append('<text class="t-cmp" x="%d" y="%d">%s</text>' % (x + 14, y + 26, name))
        for j, line in enumerate(sub):
            o.append('<text class="t-cmp-s" x="%d" y="%d">%s</text>' % (x + 14, y + 45 + j * 14, line))
    return "\n".join(o)

# ---------------- API ----------------
o = []
W = 1180
o.append('<svg viewBox="0 0 %d 760" role="img" aria-label="Architecture en couches de l\'API Palier.">' % W)

o.append(band(60, 30, 1080, 138, "Adaptateurs HTTP", "quatre publics, quatre modes d'authentification"))
o.append(boxes([
    ("Routes mobile", ["jeton utilisateur", "13 endpoints"]),
    ("Routes web", ["jeton de session", "sans compte · Checkout"]),
    ("Routes matériel", ["clé d'appareil", "barrières, capteurs, balises"]),
    ("Routes opérateur", ["session opérateur", "tarifs, plan, occupation"]),
    ("Webhooks Stripe", ["signature vérifiée", "account.updated, charge.*"]),
], 76, 76, 192, 212, 88))

o.append(band(60, 200, 1080, 152, "Domaine", "toute la logique métier, sans dépendance à HTTP ni à Stripe"))
o.append(boxes([
    ("Allocation", ["sélection atomique", "attributs puis palier"]),
    ("Sessions", ["machine à états", "présomption de place"]),
    ("Tarification", ["politique par parking", "plafond journalier"]),
    ("Holds", ["quota par parking", "un seul par usager"]),
    ("Occupation", ["compteur de passages", "places à vérifier"]),
], 76, 250, 192, 212, 88))

o.append(band(60, 384, 1080, 152, "Infrastructure", "un adaptateur par système externe, remplaçable en test"))
o.append(boxes([
    ("Dépôt Postgres", ["transactions", "SKIP LOCKED"]),
    ("Client Stripe", ["capture manuelle", "Connect destination"]),
    ("Client APNs", ["notifications", "de confirmation"]),
    ("Client barrière", ["HTTP vers", "le contrôleur"]),
    ("Signature HMAC", ["jetons de QR", "de borne"]),
], 76, 434, 192, 212, 88))

o.append(band(60, 568, 1080, 152, "Planificateur", "aucun appelant externe : les six transitions déclenchées par le temps", "bd bd-warn"))
o.append(boxes([
    ("expire_holds", ["30 s", "HELD → AVAILABLE"]),
    ("cancel_unconfirmed", ["30 s", "aucun passage en 60 s"]),
    ("release_orphans", ["5 min", "présume occupée"]),
    ("reconcile_counts", ["1 min", "compteur vs places"]),
    ("flag_stale", ["quotidienne", "7 jours sans sortie"]),
    ("purge_events", ["quotidienne", "rétention 90 jours"]),
], 76, 618, 160, 176, 88, "cmp cmp-warn"))

# dependency arrow
o.append('<path class="dep" d="M34,60 V520" marker-end="url(#ar4)"/>')
o.append('<text class="t-dep" transform="translate(24,300) rotate(-90)" text-anchor="middle">sens des dépendances</text>')
o.append('<path class="dep dep-up" d="M1158,660 V360" marker-end="url(#ar4)"/>')
o.append('<text class="t-dep" transform="translate(1170,510) rotate(-90)" text-anchor="middle">le planificateur appelle le domaine</text>')
o.append('</svg>')
api_svg = "\n".join(o)

# ---------------- Mobile ----------------
m = []
m.append('<svg viewBox="0 0 1180 830" role="img" aria-label="Architecture de l\'application mobile Palier.">')
m.append(band(60, 30, 1080, 138, "Écrans — React Native", "TypeScript, types partagés avec l'API"))
m.append(boxes([
    ("Découverte", ["carte, places libres", "bouton de hold"]),
    ("Session", ["place assignée", "compte à rebours"]),
    ("Guidage", ["plan du palier", "allée courante"]),
    ("Confirmation", ["confirmer ou", "corriger le numéro"]),
    ("Compte", ["plaques, carte", "reçus"]),
], 76, 76, 192, 212))

m.append(band(60, 200, 1080, 138, "Noyau applicatif — TypeScript", "aucune connaissance des API natives"))
m.append(boxes([
    ("Magasin d'état", ["session courante", "persistance locale"]),
    ("Client API", ["file hors ligne", "rejeu à la reconnexion"]),
    ("SDK Stripe RN", ["SetupIntent", "Apple / Google Pay"]),
    ("Scanner QR", ["armé par la balise", "de la voie d'entrée"]),
], 76, 246, 246, 270))

m.append(band(60, 370, 1080, 178, "Pont natif — le contrat", "la seule frontière du projet où une erreur coûte cher", "bd bd-accent"))
m.append('<rect class="cmp cmp-accent" x="76" y="416" width="516" height="116" rx="3"/>')
m.append('<text class="t-cmp" x="92" y="442">Commandes  JS → natif</text>')
for i, t in enumerate([
    "startMonitoring(uuid, major)      — arme la région du parking",
    "stopMonitoring()                  — à la fermeture de session",
    "keepAlive(until)                  — localisation en arrière-plan",
    "flushOfflineQueue()               — vidange à la reconnexion",
]):
    m.append('<text class="t-code" x="92" y="%d">%s</text>' % (462 + i * 17, t))
m.append('<rect class="cmp cmp-accent" x="624" y="416" width="516" height="116" rx="3"/>')
m.append('<text class="t-cmp" x="640" y="442">Événements  natif → JS</text>')
for i, t in enumerate([
    "onAisleChanged(minor, ts)         — allée la plus proche (ranging)",
    "onLotExit(ts)                     — sortie de la région du parking",
    "onParkedDetected(confidence, ts)  — automotive → walking",
    "onQueueFlushed(count)",
]):
    m.append('<text class="t-code" x="%d" y="%d">%s</text>' % (640, 462 + i * 17, t))

m.append(band(60, 580, 528, 138, "Modules natifs iOS — Swift", "livrés au MVP"))
m.append(boxes([
    ("BeaconMonitor", ["CoreLocation", "1 région · ranging"]),
    ("MotionWatcher", ["CoreMotion", "automotive → walking"]),
], 76, 626, 246, 258))

m.append(band(612, 580, 528, 138, "Modules natifs Android — Kotlin", "après le MVP", "bd bd-muted"))
m.append(boxes([
    ("BleForegroundService", ["scan continu", "notification persistante"]),
    ("ActivityRecognition", ["Play Services", "équivalent CoreMotion"]),
], 628, 626, 246, 258, 74, "cmp cmp-muted"))

m.append('<path class="dep" d="M34,60 V700" marker-end="url(#ar4)"/>')
m.append('<text class="t-dep" transform="translate(24,380) rotate(-90)" text-anchor="middle">sens des dépendances</text>')
m.append('</svg>')
mob_svg = "\n".join(m)

io.open('out/cmp_api.svg','w',encoding='utf-8').write(api_svg)
io.open('out/cmp_mobile.svg','w',encoding='utf-8').write(mob_svg)
print('ok', len(api_svg), len(mob_svg))
