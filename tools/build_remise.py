# -*- coding: utf-8 -*-
"""Dossier de remise condensé : une page HTML imprimable, puis un PDF via Chrome.

Tous les diagrammes viennent des sources de docs/ ; la prose est réécrite court.
    python3 build_remise.py            -> out/remise.html + ../remise/Palier-dossier-de-conception.pdf
"""
import io, re, subprocess, os, sys

subprocess.check_call(['python3', 'merge.py'])
SCOPED = io.open('_scoped.css', encoding='utf-8').read()

def rd(p):
    return io.open(p, encoding='utf-8').read()

D1, D2, D3, D4, D5 = (rd('../docs/%s' % f) for f in
    ['01-flux-de-donnees.html', '02-modele-de-donnees.html', '03-sequences.html',
     '04-architecture.html', '05-deploiement.html'])

def svgs(html):
    """Tous les <svg> de la page, dans l'ordre, hors pictogrammes de légende."""
    out = []
    for m in re.finditer(r'<svg[^>]*>.*?</svg>', html, flags=re.S):
        s = m.group(0)
        if 'aria-hidden="true"' in s[:200] and 'width="0"' not in s[:200]:
            continue
        out.append(s)
    return out

def defs(html):
    return [s for s in svgs(html) if 'width="0"' in s[:200]]

def figs(html):
    return [s for s in svgs(html) if 'width="0"' not in s[:200]]

def table(html, caption):
    i = html.index('<caption>' + caption)
    a = html.rindex('<table', 0, i)
    b = html.index('</table>', i) + len('</table>')
    return html[a:b]

def table_by_marker(html, marker):
    i = html.index(marker)
    a = html.rindex('<table', 0, i)
    b = html.index('</table>', i) + len('</table>')
    return html[a:b]

def strip_caption(t):
    return re.sub(r'<caption>.*?</caption>', '', t, flags=re.S)

d1 = figs(D1); d2 = figs(D2); d3 = figs(D3); d4 = figs(D4); d5 = figs(D5)
assert len(d1) == 2 and len(d2) == 3 and len(d3) == 4 and len(d4) == 2 and len(d5) == 2, \
    (len(d1), len(d2), len(d3), len(d4), len(d5))
DEFS = ''.join(defs(D3) + defs(D4) + defs(D5))

def fig(svg, cap, cls=''):
    return ('<figure class="%s"><div class="fig"><div class="fig-scroll">%s</div>'
            '<figcaption>%s</figcaption></div></figure>' % (cls, svg, cap))

def head(title, tag):
    return '<div class="sec-head"><h3>%s</h3><span class="tag">%s</span></div>' % (title, tag)

def sec(title, tag, svg, cap, lede='', side=None):
    if side:
        return '<section><div class="keep">%s%s<div class="side">%s%s</div></div>' % (head(title, tag), lede, fig(svg, cap), side)
    return '<section><div class="keep">%s%s%s</div>' % (head(title, tag), lede, fig(svg, cap))

def note(title, body, warn=False):
    return '<div class="note%s"><b>%s</b> %s</div>' % (' warn' if warn else '', title, body)

def tbl(t):
    return '<div class="tbl-scroll">%s</div>' % t

CSS = u"""
  :root{
    --ground:#fff; --surface:#F8F9F6; --surface-2:#E4E6E0;
    --ink:#191C1A; --ink-2:#3E453F; --ink-3:#6E766F;
    --line:#D2D6CE; --line-strong:#9BA298;
    --accent:#1B4B8F; --accent-soft:#DFE7F3; --accent-line:#1B4B8F;
    --store:#2E7D4F; --store-soft:#DFEEE6;
    --ext:#5A6159; --ext-soft:#E7E9E3;
    --held:#6C55A0; --held-soft:#E7E1F2;
    --warn:#A06407; --warn-soft:#F6EBD6;
    --stop:#9C3A2A; --stop-soft:#F4E1DD;
  }
  @page{size:Letter;margin:15mm 14mm 16mm 14mm}
  *{box-sizing:border-box}
  html{font-size:10pt}
  body{margin:0;background:#fff;color:var(--ink);
    font-family:"Newsreader",Georgia,serif;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  a{color:inherit;text-decoration:none}

  .cover{padding-top:14mm;break-after:page}
  .cover .eyebrow{font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3)}
  .cover h1{font-family:"Archivo",system-ui,sans-serif;font-weight:700;letter-spacing:-.03em;line-height:.95;font-size:3.8rem;margin:.1em 0 .08em}
  .cover .sub{color:var(--ink-2);max-width:60ch;margin:.3em 0 0;font-size:1.15rem}
  .cover hr{height:5px;background:var(--ink);border:0;margin:22px 0 0}
  .cover hr::after{content:"";display:block;height:2px;background:var(--ink);margin-top:4px}
  .cover .meta{display:flex;flex-wrap:wrap;gap:6px 26px;padding:12px 0 0;font-family:"IBM Plex Mono",monospace;font-size:.74rem;color:var(--ink-3)}
  .cover .meta b{color:var(--ink-2);font-weight:500}
  .cover p.lead{margin:4px 0 0;max-width:none;color:var(--ink-2);font-size:.93rem;line-height:1.38}
  .cover h2.pb{font-family:"Archivo",sans-serif;font-weight:600;font-size:1.02rem;letter-spacing:-.01em;margin:14px 0 0}
  .cover .toc{margin-top:16px;max-width:none;display:grid;grid-template-columns:1fr 1fr;column-gap:24px}
  .cover .toc li{padding:6px 0}
  .cover .toc li:nth-child(3){border-bottom:1px solid var(--line)}
  .toc{margin:28px 0 0;padding:0;list-style:none;max-width:68ch}
  .toc li{display:grid;grid-template-columns:44px 1fr;gap:14px;border-top:1px solid var(--line);padding:8px 0;align-items:baseline}
  .toc li:last-child{border-bottom:1px solid var(--line)}
  .toc .n{font-family:"IBM Plex Mono",monospace;font-size:.8rem;font-weight:600;color:var(--accent)}
  .toc .ti{font-family:"Archivo",sans-serif;font-weight:600;font-size:1rem}
  .toc .ds{display:block;font-weight:400;font-family:"Newsreader",serif;color:var(--ink-2);font-size:.92rem}

  .part{break-before:page}
  .side{display:grid;grid-template-columns:60fr 40fr;gap:10px;align-items:start}
  .side > *{min-width:0}
  .side .note{margin-top:0!important}
  #d1 figure:nth-of-type(2) .fig-scroll svg{width:90%!important;margin:0 auto}
  #d1 figure:nth-of-type(1) .fig-scroll svg{width:78%!important;margin:0 auto}
  #d4 figure:nth-of-type(2) .fig-scroll svg{width:84%!important;margin:0 auto}
  #d5 figure:nth-of-type(2) .fig-scroll svg{width:80%!important;margin:0 auto}
  .part-head{border-bottom:3px solid var(--ink);padding:0 0 8px;margin:0 0 12px;break-after:avoid}
  .part-n{font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
  .part-head h2{font-family:"Archivo",sans-serif;font-weight:700;letter-spacing:-.024em;font-size:1.9rem;line-height:1;margin:.15em 0 .1em}
  .part-head p{color:var(--ink-2);margin:0;max-width:70ch}

  /* neutralise la mise en page écran des articles fusionnés */
  article .wrap{max-width:none!important;padding:0!important;margin:0!important}
  article section{margin-top:14px!important;break-inside:auto!important}
  article .sec-head{margin-bottom:8px!important;padding-bottom:5px!important;border-bottom-width:1.5px!important}
  article .sec-head h3{font-family:"Archivo",sans-serif;font-weight:600;font-size:1.12rem;letter-spacing:-.015em;margin:0;line-height:1.15}
  article .sec-head .tag{font-size:.68rem!important}
  article .lede{margin:0 0 8px!important;max-width:none!important;font-size:.98rem}
  article figure{margin:0 0 8px!important;break-inside:avoid}
  article .fig{padding:6px 4px 2px!important;border-radius:2px!important}
  article .fig-scroll{overflow:visible!important}
  article .fig-scroll svg{min-width:0!important;width:100%!important;height:auto!important;display:block}
  figure.half .fig-scroll svg{width:100%!important}
  article figcaption{font-size:.7rem!important;padding:5px 8px 2px!important;line-height:1.45!important}
  article .note{margin-top:8px!important;padding:7px 12px!important;font-size:.9rem!important;max-width:none!important;break-inside:avoid;line-height:1.4}
  article .note b{font-weight:600!important}
  article .tbl-scroll{overflow:visible!important;margin-top:8px!important;break-inside:auto}
  article table{width:100%!important;min-width:0!important;font-size:.77rem!important;border-collapse:collapse}
  article caption{padding:10px 0 4px!important;font-size:.9rem!important;break-after:avoid}
  article th{font-size:.62rem!important;padding:0 8px 4px 0!important}
  article td{padding:2px 8px 2px 0!important;line-height:1.35!important;vertical-align:top;white-space:normal!important;overflow-wrap:anywhere}
  article table{table-layout:auto}
  article .sec-head{break-after:avoid}
  .keep figure{break-inside:avoid}
  article tr{break-inside:avoid}
  article code{font-size:.8em!important;padding:0 3px!important}
  article .key{margin:0 0 8px!important;font-size:.7rem!important}
  article .conv,article .todo{display:none!important}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start;break-inside:avoid}
  article thead{break-after:avoid}
  #d2 table{font-size:.74rem!important}
  #d2 td{padding:1px 6px 1px 0!important}
  .two > *{min-width:0}
  .keep{break-inside:avoid}
"""

# ---------------------------------------------------------------- contenu
o = []; a = o.append
a(u'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Palier — Dossier de conception</title>')
a(u'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap">')
a(u'<style>%s\n%s</style></head><body>' % (CSS, SCOPED))
a(DEFS)

a(u"""<div class="cover">
  <div class="eyebrow">Dossier de conception</div>
  <h1>Palier</h1>
  <p class="sub">Système d'allocation de places en stationnement intérieur, multi-opérateurs.</p>
  <hr>
  <div class="meta"><span><b>49</b> décisions</span><span><b>14</b> contraintes</span><span><b>12</b> entités · <b>2</b> machines à états</span><span><b>35</b> endpoints</span><span><b>13</b> diagrammes</span></div>
  <h2 class="pb">La problématique</h2>
  <p class="lead">Tout conducteur connaît la scène. L'application ou le panneau annonce des places libres, on descend trois paliers, et il n'y en a aucune. Le chiffre affiché venait d'un compteur approximatif, d'une mise à jour vieille de vingt minutes, ou d'un stationnement qui compte ses abonnés comme des places libres. On tourne, on remonte, on ressort, et le prochain stationnement affiche lui aussi des places libres. Chercher une place représente plusieurs minutes par visite en centre-ville, et la promesse « places disponibles » ne vaut rien tant que personne ne garantit qu'une place précise vous attend.</p>
  <h2 class="pb">Notre solution</h2>
  <p class="lead">Palier ne promet pas un nombre, il promet une place. Le conducteur voit la disponibilité réelle avant de partir et peut bloquer une place quinze minutes. À l'entrée, il scanne un QR à la borne : le système lui assigne une place précise, pré-autorise le plafond journalier sur sa carte et ouvre la barrière. La boucle de la barrière compte chaque véhicule qui passe, abonnés compris : c'est ce compteur, et non une estimation, qui borne le nombre de places libres affiché. Une balise BLE par allée et le capteur de mouvement du téléphone présument la place occupée dès que le conducteur descend de voiture, sans aucun geste. À la sortie, le véhicule est identifié sans geste et le montant est capturé sur la pré-autorisation. Aucune caméra, aucun billet, aucun terminal de paiement. Un usager sans l'app scanne le même QR avec son appareil photo : une page web avec Apple Pay fait le reste.</p>
  <ul class="toc">
    <li><span class="n">00</span><span class="ti">Contraintes établies<span class="ds">Quatorze propriétés des plateformes, du droit et du lieu qui ont fermé des branches entières</span></span></li>
    <li><span class="n">01</span><span class="ti">Flux de données<span class="ds">Diagramme de contexte et décomposition de niveau 1, notation Gane-Sarson, 35 flux</span></span></li>
    <li><span class="n">02</span><span class="ti">Modèle de données et états<span class="ds">Douze entités, deux machines à états, la surface API</span></span></li>
    <li><span class="n">03</span><span class="ti">Diagrammes de séquence<span class="ds">Entrée, confirmation de place, sortie et facturation, adhésion d'un opérateur</span></span></li>
    <li><span class="n">04</span><span class="ti">Architecture applicative<span class="ds">Couches de l'API, application React Native, contrat du pont natif</span></span></li>
    <li><span class="n">05</span><span class="ti">Déploiement et démonstration<span class="ds">Quatre zones d'exécution, montage de démonstration, ordre de construction</span></span></li>
  </ul>
</div>""")

# ---- 00 contraintes
a(u"""<article id="d0" class="part">
<div class="part-head"><div class="part-n">Document 00</div><h2>Contraintes établies</h2>
<p>Ces points n'ont jamais été soumis au choix : ce sont des propriétés des plateformes, du droit applicable ou de la physique du lieu. Ils expliquent trois absences — aucun marqueur scannable aux places, aucun guidage continu, aucune caméra obligatoire.</p></div>
<div class="tbl-scroll"><table>
<thead><tr><th>Contrainte</th><th>Ce qu'elle impose</th></tr></thead><tbody>
<tr><td>Achat intégré Apple</td><td>Interdit pour les services du monde physique. La facturation passe par Stripe ; Apple Pay et Google Pay ne sont que des moyens de paiement.</td></tr>
<tr><td>GPS en sous-sol</td><td>Inutilisable sous une dalle de béton. Tout le positionnement intérieur repose sur le BLE.</td></tr>
<tr><td>Régions iBeacon sur iOS</td><td>Vingt régions au maximum par application ; le <em>ranging</em> fiable exige une app vivante. D'où une seule région par parking (<code>major</code>), l'allée dans <code>minor</code>, l'allée résolue par ranging.</td></tr>
<tr><td>Précision du ranging BLE</td><td>±2 à 3 m en milieu réfléchissant, contre 2,6 m de largeur de place. Une balise par place donnerait couramment la mauvaise place ; une balise par allée, donc.</td></tr>
<tr><td>Détection du stationnement</td><td>CoreMotion expose les transitions « en voiture → arrêté → à pied » en arrière-plan, à condition que l'app tourne. C'est le mécanisme d'Apple pour « Voiture garée ».</td></tr>
<tr><td>Réveil en arrière-plan</td><td>Une entrée de région réveille une app terminée une dizaine de secondes seulement. La manœuvre dure une à trois minutes : l'app doit se maintenir vivante elle-même, depuis le scan.</td></tr>
<tr><td>Boucles de barrière</td><td>Toute barrière industrielle a des boucles inductives dans la chaussée, exposées par le contrôleur en contacts. Preuve de passage gratuite, insensible à la neige et à l'éclairage.</td></tr>
<tr><td>Plaque au Québec</td><td>Seule la plaque arrière est obligatoire, et elle est illisible une partie de l'année (neige, support à vélo). Une lecture de plaque ne peut pas porter l'exactitude du système.</td></tr>
<tr><td>Loi 25</td><td>Plaque, horodatages et positions sont des renseignements personnels : consentement, durée de conservation définie, évaluation des facteurs relatifs à la vie privée.</td></tr>
<tr><td>Balises sur Android</td><td>Aucun équivalent d'iBeacon, scan bridé en arrière-plan depuis Android 8. Contournement : service de premier plan.</td></tr>
<tr><td>Règle 4.8 de l'App Store</td><td>Offrir un login tiers impose Sign in with Apple. Le couple Apple + Google est conforme.</td></tr>
<tr><td>Cartes et Stripe Connect</td><td>En charges directes, une carte enregistrée sur la plateforme n'est pas réutilisable chez un opérateur. D'où les charges destination.</td></tr>
<tr><td>Concurrence en base</td><td>Deux assignations simultanées de la même place s'éliminent au niveau du SGBD (<code>FOR UPDATE SKIP LOCKED</code>), pas en logique applicative.</td></tr>
<tr><td>Validité d'une pré-autorisation</td><td>Un montant capturé doit rester sous le montant autorisé, dans les sept jours. D'où le plafond journalier obligatoire et la session plafonnée à 24 h.</td></tr>
</tbody></table></div>
</article>""")

# ---- 01 DFD
a(u"""<article id="d1" class="part">
<div class="part-head"><div class="part-n">Document 01</div><h2>Flux de données</h2>
<p>Le système vu comme une boîte, puis décomposé en huit processus et six dépôts. Notation Gane-Sarson : rectangle arrondi pour un processus, cellule à gauche pour un dépôt, double trait pour un dépôt redessiné ailleurs, pastille numérotée pour chaque flux.</p></div>
<div class="wrap">""")
a(sec(u"Figure 1 — Diagramme de contexte", u"Niveau 0 · 9 entités externes", d1[0], u"Le conducteur est le seul acteur humain du parcours ; l'opérateur n'intervient qu'en configuration. La boucle d'entrée et la barrière de sortie sont du matériel existant que Palier commande et écoute."))
a(note(u"Deux déclencheurs temporels n'apparaissent pas sur la figure.",
       u"L'expiration d'un hold après 15 minutes (D3 revient à <code>AVAILABLE</code>) et l'annulation d'une assignation dont la boucle n'a pas confirmé le passage 60 secondes après l'ouverture, qui libère aussi la pré-autorisation. Un DFD ne représente pas le temps ; ces transitions figurent au diagramme d'états."))
a(u"""</section>""")
a(sec(u"Figure 2 — Décomposition", u"Niveau 1 · 8 processus · 6 dépôts · 35 flux", d1[1], u"Processus empilés dans l'ordre du parcours réel, entités à gauche, dépôts à droite. D3 (Places) et D4 (Sessions) sont répétés à plusieurs hauteurs pour garder les flux courts."))
a(tbl(table(D1, u"Légende des flux — conducteur et entités externes")))
a('<div class="two">' + tbl(table(D1, u"Légende des flux — enchaînement des processus")) + tbl(table(D1, u"Légende des flux — accès aux dépôts et aux services tiers")) + '</div>')
a(u'</section></div></article>')

# ---- 02 modèle
a(u"""<article id="d2" class="part">
<div class="part-head"><div class="part-n">Document 02</div><h2>Modèle de données et états</h2>
<p>La fondation : douze entités persistantes, les deux machines à états qui portent la logique métier, et la surface API qui les expose. Tous les autres diagrammes s'y réfèrent.</p></div>
<div class="wrap">""")
a(sec(u"Modèle relationnel", u"12 entités · pied-de-corbeau", d2[0], u"Trois blocs : l'infrastructure d'un opérateur descend d'operator jusqu'à spot ; le compte du conducteur tient en deux tables ; la transaction relie les deux. Encadré bleu : les cinq tables dont la logique métier dépend directement."))
a(tbl(table(D2, u"spot")))
a(tbl(table(D2, u"session")))
a(tbl(table(D2, u"Les dix autres tables")))
a(note(u"L'assignation tient en une requête, et c'est ce qui la rend sûre.",
       u"<code>UPDATE spot … WHERE id = (SELECT id FROM spot WHERE … AND state = 'AVAILABLE' ORDER BY level, aisle, needs_check, distance_to_exit LIMIT 1 FOR UPDATE SKIP LOCKED)</code>. Deux conducteurs à deux cents millisecondes d'intervalle ne peuvent pas obtenir la même place : la clause fait sauter au second la ligne prise par le premier. Un index partiel sur les places <code>AVAILABLE</code> sert cette requête pendant qu'une voiture attend devant la barrière."))
a(u"""</section>""")
a(sec(u"Machine à états — place", u"spot.state", d2[1], u"Trait plein : transition provoquée par un acteur ou un signal. Trait pointillé : transition provoquée par le temps. Le silence ne libère jamais une place : le garde-fou de 30 minutes la présume occupée. Une place sortant de OCCUPIED_UNKNOWN revient à AVAILABLE avec needs_check à vrai."))
a(u"""</section>""")
a(sec(u"Machine à états — session", u"session.state", d2[2], u"Session et place évoluent en parallèle, pas en miroir : c'est ce qui rend le cas « mauvaise place » représentable. CLOSED_PAID n'est pas terminal : la session est anonymisée après 90 jours.", side=note(u"Le seul état où place et session divergent volontairement.",
       u"Quand l'usager, interrogé parce que l'allée détectée n'était pas la sienne, indique un autre numéro, la session passe à <code>PARKED_CONFIRMED</code> avec <code>confirmed_spot_id</code> différent de <code>assigned_spot_id</code>. Deux lignes de <code>spot</code> changent dans la même transaction : la place réelle passe à <code>OCCUPIED</code>, l'ancienne à <code>OCCUPIED_UNKNOWN</code>. Hors transaction, une coupure réseau laisserait une place fantôme.", warn=True)))
a(u"""</section><section>
<div class="sec-head"><h3>Surface API</h3><span class="tag">5 publics · 4 modes d'authentification</span></div>
<p class="lede">L'app du conducteur (jeton utilisateur), la page web sans compte (jeton de session), le matériel de terrain (clé d'appareil), le tableau de bord opérateur (session opérateur), et les tâches planifiées, qu'aucun appelant externe ne déclenche.</p>""")
a(tbl(table(D2, u"Application mobile")))
a('<div class="two">' + tbl(table(D2, u"Page web, usager sans compte")) + tbl(table(D2, u"Tableau de bord opérateur")) + '</div>')
a(tbl(table(D2, u"Matériel de terrain")))
a(tbl(table(D2, u"Tâches planifiées")))
a(u'</section></div></article>')

# ---- 03 séquences
a(u"""<article id="d3" class="part">
<div class="part-head"><div class="part-n">Document 03</div><h2>Diagrammes de séquence</h2>
<p>Les quatre parcours où plusieurs systèmes se coordonnent et où l'ordre des appels est une décision de conception. Trait plein : appel ; pointillé : retour ; cadre ambre : fragment conditionnel.</p></div>
<div class="wrap">""")
a(sec(u"Séquence A — Entrée au parking", u"7 participants · 18 messages", d3[0], u"L'assignation précède l'appel à Stripe, la pré-autorisation précède l'ouverture, la boucle confirme après.", side=note(u"Trois contraintes d'ordre.",
       u"L'assignation vient <b>avant</b> Stripe : appeler Stripe pour un parking complet coûte une pré-autorisation à annuler. La pré-autorisation vient <b>avant</b> l'ouverture : une carte refusée après l'ouverture est irrattrapable. La preuve d'entrée vient <b>après</b> l'ouverture, par construction : c'est la fermeture de la boucle sous la lisse qui la donne, plaque enneigée ou non. Le premier fragment montre les deux populations, l'app ou un navigateur qui pré-autorise par Apple Pay sans compte, sur le même jeton de borne. Sans passage en 60 secondes, la tâche <code>cancel_unconfirmed_entries</code> annule la place <b>et</b> la pré-autorisation.")))
a(tbl(table(D3, u"Budget temps d'une visite type")))
a(note(u"Le temps par usager n'est pas le risque, la capacité de la voie l'est.",
       u"Une voie qui reçoit 300 véhicules à l'heure tourne à 75 % avec un cycle de 9 s et sature au-delà de 12 s. D'où le scanner armé par la balise d'entrée : déverrouillage et lancement de l'app se font en roulant vers la borne, il ne reste que viser et scanner. Le contrôleur horodate l'arrivée sur la boucle d'armement et la fermeture de la boucle : le prototype mesure lui-même ce tableau, et la sortie sans geste contre le paiement à la voie se voit au chronomètre."))
a(u"""</section>""")
a(sec(u"Séquence B — Confirmation de la place", u"7 participants · 18 messages", d3[1], u"Trois branches : présomption silencieuse, allée contradictoire, place prise. Seules les deux dernières font apparaître l'usager.", side=note(u"La présomption est une décision, pas une approximation.",
       u"L'app, maintenue vivante depuis le scan par la localisation en arrière-plan, connaît l'allée la plus proche par ranging. Au signal « à pied » dans l'allée assignée, l'API écrit <code>PARKED_PRESUMED</code> et <code>OCCUPIED</code> sans rien demander. L'usager n'est sollicité que si l'allée contredit l'assignation, ou s'il signale sa place prise — deux opérations à deux écritures, dans une seule transaction. Le compteur de passages borne l'erreur cumulée.", warn=True)))
a(u"""</section>""")
a(sec(u"Séquence C — Sortie et facturation", u"6 participants · 17 messages", d3[2], u"Trois façons d'identifier le véhicule, de la plus automatique à la moins ; la suite est identique : capture, ouverture, boucle. Le scan du QR de sortie vaut pour l'app comme pour la page web.", side=note(u"Jamais d'ouverture sans autorisation valide — et elle est garantie à l'entrée.",
       u"Le montant capturé est toujours couvert par le plafond pré-autorisé, la session est plafonnée à 24 h : un refus de carte à la sortie n'existe pas. Si Stripe est injoignable, la barrière ouvre quand même, les fonds étant bloqués ; <code>retry_captures</code> rejoue la capture. L'ouverture par balise exige deux conditions : une seule session candidate dans la dernière minute <b>et</b> un véhicule sur la boucle d'armement. La page web retrouve sa session par un jeton conservé trois fois dès l'entrée : cookie, passe Wallet, lien par SMS ou courriel ; le numéro de place seul n'est jamais une preuve. Une session sans sortie après sept jours n'est jamais facturée d'office, elle part en vérification. Le téléphone déchargé est le cas du billet perdu : le personnel.")))
a(u"""</section>""")
a(sec(u"Séquence D — Adhésion d'un opérateur", u"5 participants · 14 messages", d3[3], u"Le seul parcours asynchrone : le KYC se fait sur une page hébergée par Stripe et revient par webhook, des minutes ou des jours plus tard.", side=note(u"Deux verrous empêchent un parking d'être mis en ligne à moitié configuré.",
       u"L'API refuse une politique tarifaire sans plafond journalier, puisque c'est ce montant qui est pré-autorisé. Et un parking reste hors ligne tant que <code>wifi_verified_at</code> et <code>gate.verified_at</code> sont nuls : sans réseau aux paliers, pas de présomption ; sans barrière pilotable dont les boucles sont remontées, ni preuve de passage ni compteur.")))
a(u'</section></div></article>')

# ---- 04 architecture
a(u"""<article id="d4" class="part">
<div class="part-head"><div class="part-n">Document 04</div><h2>Architecture applicative</h2>
<p>Le découpage en composants de l'API et de l'application mobile, et le contrat exact de la frontière entre le TypeScript et les modules natifs — l'endroit où le projet peut déraper.</p></div>
<div class="wrap">""")
a(sec(u"API — architecture en couches", u"4 couches · 21 composants", d4[0], u"Le domaine ne connaît ni HTTP ni Stripe : il reçoit des objets et rend des décisions. Le planificateur est la seule couche qui remonte : il appelle le domaine sans passer par HTTP."))
a(tbl(table(D4, u"Ce que chaque composant du domaine décide")))
a(note(u"Pourquoi le planificateur est dessiné à part.",
       u"Ses tâches sont les transitions déclenchées par le temps, et elles portent des règles métier majeures : expiration d'un hold, annulation d'une entrée jamais passée, garde-fou du téléphone déchargé, réconciliation du compteur avec les places, rejeu des captures, mise en vérification des sessions sans sortie. Les enfouir dans un cron les rendrait invisibles à la lecture du code. Il tourne en instance unique, sous verrou consultatif Postgres."))
a(u"""</section>""")
a(sec(u"Application mobile", u"React Native + modules natifs", d4[1], u"Une seule base TypeScript, deux implémentations natives de la même frontière. Les modules Android sont en pointillé : le contrat existe, l'implémentation vient après le MVP."))
a(note(u"Le contrat du pont est le livrable le plus important de cette page.",
       u"Quatre commandes descendent, quatre événements remontent. <code>keepAlive</code> est la commande qui maintient l'app vivante entre le scan et la présomption : localisation en arrière-plan sur iOS (permission « Toujours »), service de premier plan sur Android. Le contrat nomme la commande sans dire comment chaque plateforme l'honore ; tant que ces huit signatures ne changent pas, le Kotlin s'écrit plus tard sans toucher au TypeScript.", warn=True))
a(tbl(table(D4, u"Répartition du travail par surface")))
a(u'</section></div></article>')

# ---- 05 déploiement
a(u"""<article id="d5" class="part">
<div class="part-head"><div class="part-n">Document 05</div><h2>Déploiement et démonstration</h2>
<p>Où s'exécute chaque composant, ce qui est installé dans le garage, et le montage exact de la démonstration.</p></div>
<div class="wrap">""")
a(sec(u"Diagramme de déploiement", u"4 zones · 14 nœuds", d5[0], u"Les appareils que l'on ne contrôle pas, le nuage que l'on contrôle, les services tiers dont on dépend, et le garage, où le matériel tombe en panne et où une panne est invisible depuis le nuage."))
a(note(u"Le garage porte les deux pré-requis d'adhésion.",
       u"Une couverture Wi-Fi aux paliers et aux deux bornes, et une barrière pilotable dont les boucles sont remontées — par contact sec, universel sur les opérateurs industriels, ou par l'API du contrôle d'accès existant. Palier n'installe pas de barrières ; il commande celles qui sont là et lit les boucles qu'elles ont déjà. Troisième pré-requis : une couverture cellulaire mesurée aux deux bornes, parce que l'usager sans l'app ne rejoindra jamais le Wi-Fi du garage. Un contrôleur qui ne joint plus l'API refuse l'entrée et ouvre la sortie sans condition, en comptant localement. Aucune caméra n'est exigée : la lecture de plaque est une option de confort de l'opérateur. Une balise à pile morte n'émet rien : d'où le <code>heartbeat</code> des contrôleurs et la remontée du niveau de pile.", warn=True))
a(u"""</section>""")
a(sec(u"Montage de la démonstration", u"2 allées · 10 places · 3 balises", d5[1], u"Dix places suffisent à montrer les six états, l'assignation par allée et le cas de la mauvaise place. Seules les trois balises sont du matériel ; les boucles sont simulées par un bouton de la console.", side=note(u"L'étape 4 avant l'étape 5, pas l'inverse.",
       u"Le module natif est le seul chantier dont l'échec remettrait en cause la conception. Il doit produire deux mesures : l'app survit trois minutes après le scan avec l'écran éteint, et le ranging distingue deux allées adjacentes dans un vrai garage. Si l'une échoue, le repli est une notification différée à la sortie de la région du parking — pas une refonte. Limites annoncées : aucune barrière physique ni capteur de place n'est monté, Android n'est pas livré, les séjours de plus de 24 h ne sont pas gérés.")))
a(tbl(table(D5, u"Matériel de la démonstration")))
a(tbl(table_by_marker(D5, u"<th>Étape</th>")))
a(u'</section></div></article>')

a(u'</body></html>')
out = u'\n'.join(o)

# aucun tiret cadratin : « : » dans les titres et légendes, « · » dans les diagrammes, « , » ailleurs
def _dedash(html):
    parts = re.split(r'(<svg[^>]*>.*?</svg>)', html, flags=re.S)
    res = []
    for k, part in enumerate(parts):
        if k % 2 == 1:
            res.append(part.replace(u' — ', u' · ').replace(u'—', u'·')); continue
        part = re.sub(r'(<(?:h2|h3|caption|figcaption)[^>]*>)(.*?)(</(?:h2|h3|caption|figcaption)>)',
                      lambda m: m.group(1) + m.group(2).replace(u' — ', u' : ') + m.group(3), part, flags=re.S)
        part = part.replace(u' — ', u', ').replace(u'—', u'-')
        res.append(part)
    return ''.join(res)
out = _dedash(out)
assert u'—' not in out
io.open('out/remise.html', 'w', encoding='utf-8').write(out)
print('html', len(out))

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
pdf = os.path.abspath('../remise/Palier-dossier-de-conception.pdf')
subprocess.check_call([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                       '--virtual-time-budget=8000',
                       '--print-to-pdf=' + pdf, 'file://' + os.path.abspath('out/remise.html')],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
data = open(pdf, 'rb').read()
print('pdf', len(data), 'octets,', len(re.findall(rb'/Type\s*/Page[^s]', data)), 'pages')
