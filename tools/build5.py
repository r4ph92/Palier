# -*- coding: utf-8 -*-
import io

def node(x, y, w, h, title, lines, cls="nd"):
    o = ['<rect class="%s" x="%d" y="%d" width="%d" height="%d" rx="3"/>' % (cls, x, y, w, h)]
    o.append('<text class="t-nd" x="%d" y="%d">%s</text>' % (x + 14, y + 25, title))
    for i, l in enumerate(lines):
        o.append('<text class="t-nd-s" x="%d" y="%d">%s</text>' % (x + 14, y + 44 + i * 15, l))
    return "\n".join(o)

def zone(x, y, w, h, label, cls="zn"):
    return ('<rect class="%s" x="%d" y="%d" width="%d" height="%d" rx="5"/>\n'
            '<text class="t-zn" x="%d" y="%d">%s</text>') % (cls, x, y, w, h, x + 16, y + 24, label)

# ---------------- deploiement ----------------
o = ['<svg viewBox="0 0 1180 664" role="img" aria-label="Diagramme de déploiement de Palier.">']

o.append(zone(40, 30, 330, 250, "Appareils des usagers"))
o.append(node(60, 66, 290, 92, "iPhone", ["app React Native + module Swift",
                                          "BLE · CoreMotion · caméra QR",
                                          "file hors ligne locale"], "nd nd-cli"))
o.append(node(60, 174, 290, 88, "Navigateur — opérateur", ["tableau de bord web",
                                                            "session opérateur"], "nd nd-cli"))

o.append(zone(410, 30, 400, 250, "Nuage — plateforme"))
o.append(node(430, 66, 360, 92, "API — conteneurs", ["2 instances derrière un répartiteur",
                                                     "adaptateurs · domaine · infrastructure",
                                                     "TLS terminé au répartiteur"], "nd nd-srv"))
o.append(node(430, 174, 175, 88, "Postgres", ["managé", "sauvegarde continue"], "nd nd-db"))
o.append(node(615, 174, 175, 88, "Planificateur", ["4 tâches", "instance unique"], "nd nd-srv"))

o.append(zone(850, 30, 290, 250, "Services tiers"))
o.append(node(870, 66, 250, 62, "Stripe Connect", ["comptes Express"], "nd nd-svc"))
o.append(node(870, 140, 250, 58, "APNs", ["notifications"], "nd nd-svc"))
o.append(node(870, 210, 250, 58, "OAuth Apple · Google", ["authentification"], "nd nd-svc"))

o.append(zone(40, 320, 1100, 300, "Garage — équipement de terrain", "zn zn-site"))
o.append(node(64, 372, 250, 104, "Borne d'entrée", ["QR statique signé (HMAC)",
                                                    "contact sec ou API du système",
                                                    "de contrôle d'accès existant"], "nd nd-hw"))
o.append(node(334, 372, 250, 104, "Caméra d'entrée", ["vise la plaque arrière",
                                                      "posée après la barrière",
                                                      "reconnaissance hébergée"], "nd nd-hw"))
o.append(node(604, 372, 250, 104, "Barrière de sortie", ["caméra ANPR",
                                                         "QR de repli",
                                                         "contact sec ou API existante"], "nd nd-hw"))
o.append(node(874, 372, 242, 104, "Balises BLE", ["une par allée",
                                                  "UUID unique · major = allée",
                                                  "pile remontée à l'API"], "nd nd-hw"))
o.append(node(64, 500, 520, 92, "Pré-requis d'adhésion", ["Wi-Fi : paliers et les deux bornes",
                                                           "barrière pilotable : contact sec ou API",
                                                           "wifi_verified_at et gate.verified_at"], "nd nd-net"))
o.append(node(604, 500, 512, 92, "Ce que le Wi-Fi ne fait pas", ["iOS n'expose aucun scan Wi-Fi aux apps tierces",
                                                                  "le Wi-Fi RTT est Android seulement",
                                                                  "aucun rôle dans le positionnement"], "nd nd-neg"))

# liaisons fleches
o.append('<g class="lnk">')
for d in ["M350,112 H430",                       # iPhone -> API
          "M350,218 H392 V112 H430",             # navigateur operateur -> API
          "M790,112 H870",                       # API -> Stripe
          "M790,112 H830 V169 H870",             # API -> APNs
          "M790,112 H830 V210 H870",             # API -> OAuth
          "M700,158 V174",                       # API -> planificateur
          "M610,302 V158"]:                      # bus du garage -> API
    o.append('<path d="%s" marker-end="url(#ar5)"/>' % d)
o.append('</g>')
# bus de collecte du garage, sans tete de fleche
o.append('<g class="lnk"><path d="M204,372 V302 H995 V372"/>'
         '<path d="M459,372 V302"/><path d="M729,372 V302"/></g>')
o.append('<text class="t-lnk" x="700" y="294">HTTPS · Wi-Fi du garage</text>')
o.append('</svg>')
io.open('out/dep.svg','w',encoding='utf-8').write("\n".join(o))

# ---------------- plan de demo ----------------
p = ['<svg viewBox="0 0 1100 560" role="img" aria-label="Plan physique du montage de démonstration.">']
p.append('<rect class="floor" x="40" y="60" width="1020" height="440" rx="4"/>')
p.append('<text class="t-zn" x="60" y="90">Palier de démonstration — deux allées, dix places</text>')

# aisle A
p.append('<text class="t-aisle" x="60" y="152">Allée A — major 1</text>')
for i in range(5):
    x = 60 + i * 118
    st = ["AVAILABLE", "AVAILABLE", "ASSIGNED", "OCCUPIED", "AVAILABLE"][i]
    cls = {"AVAILABLE": "sp-a", "ASSIGNED": "sp-s", "OCCUPIED": "sp-o"}[st]
    p.append('<rect class="sp %s" x="%d" y="168" width="104" height="72" rx="2"/>' % (cls, x))
    p.append('<text class="t-sp" x="%d" y="198">A-%d</text>' % (x + 52, i + 1))
    p.append('<text class="t-sp-s" x="%d" y="216">%s</text>' % (x + 52, st))
p.append('<circle class="bcn" cx="360" cy="140" r="11"/><text class="t-bcn" x="378" y="145">balise 1</text>')

p.append('<text class="t-aisle" x="60" y="312">Allée B — major 2</text>')
for i in range(5):
    x = 60 + i * 118
    st = ["AVAILABLE", "OCCUPIED_UNKNOWN", "AVAILABLE", "AVAILABLE", "HELD"][i]
    cls = {"AVAILABLE": "sp-a", "OCCUPIED_UNKNOWN": "sp-u", "HELD": "sp-h"}[st]
    p.append('<rect class="sp %s" x="%d" y="328" width="104" height="72" rx="2"/>' % (cls, x))
    p.append('<text class="t-sp" x="%d" y="358">B-%d</text>' % (x + 52, i + 1))
    p.append('<text class="t-sp-s" x="%d" y="376">%s</text>' % (x + 52, st))
p.append('<circle class="bcn" cx="360" cy="300" r="11"/><text class="t-bcn" x="378" y="305">balise 2</text>')

p.append(node(700, 130, 330, 116, "Borne d'entrée", ["QR signé imprimé, affiché au mur",
                                                     "aucune barrière physique",
                                                     "l'app affiche l'ouverture"], "nd nd-hw"))
p.append(node(700, 274, 330, 116, "Borne de sortie", ["QR signé imprimé",
                                                       "capture Stripe en mode test",
                                                       "l'app affiche le reçu et l'ouverture"], "nd nd-hw"))
p.append('<path class="flow5" d="M700,188 H660 V148 H600" marker-end="url(#ar5)"/>')
p.append('<path class="flow5" d="M700,332 H660 V420 H600" marker-end="url(#ar5)"/>')
p.append('<text class="t-lnk" x="612" y="440">sortie</text>')
p.append('<text class="t-lnk" x="612" y="140">entrée</text>')
p.append('<text class="t-nd-s" x="60" y="470">États illustrés au moment de la capture — seules les balises sont du matériel ; tout le reste est du logiciel.</text>')
p.append('</svg>')
io.open('out/plan.svg','w',encoding='utf-8').write("\n".join(p))
print('ok')
