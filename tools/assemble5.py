# -*- coding: utf-8 -*-
import io
from assemble3 import HEAD

def rd(p): return io.open(p, encoding='utf-8').read()

EXTRA = u"""<style>
  .zn{fill:none;stroke:var(--line-strong);stroke-width:1.4;stroke-dasharray:7 5}
  .zn-site{stroke:var(--warn);stroke-dasharray:none;stroke-width:1.8}
  .t-zn{font-family:"Archivo",sans-serif;font-size:13px;font-weight:600;fill:var(--ink-3)}
  .nd{stroke-width:1.7}
  .nd-cli{fill:var(--ext-soft);stroke:var(--ext)}
  .nd-srv{fill:var(--accent-soft);stroke:var(--accent)}
  .nd-db{fill:var(--store-soft);stroke:var(--store)}
  .nd-svc{fill:var(--held-soft);stroke:var(--held)}
  .nd-hw{fill:var(--warn-soft);stroke:var(--warn)}
  .nd-net{fill:var(--surface-2);stroke:var(--ink-3)}
  .nd-neg{fill:none;stroke:var(--ink-3);stroke-dasharray:5 4}
  .t-nd{font-family:"Archivo",sans-serif;font-size:13px;font-weight:600;fill:var(--ink)}
  .t-nd-s{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:var(--ink-3)}
  .lnk path{fill:none;stroke:var(--line-strong);stroke-width:1.5}
  .flow5{fill:none;stroke:var(--line-strong);stroke-width:1.6}
  .t-lnk{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:var(--ink-3);text-anchor:middle}
  .floor{fill:var(--surface-2);stroke:var(--line-strong);stroke-width:1.5}
  .t-aisle{font-family:"Archivo",sans-serif;font-size:12.5px;font-weight:600;fill:var(--ink-2)}
  .sp{stroke-width:1.8}
  .sp-a{fill:var(--store-soft);stroke:var(--store)}
  .sp-s{fill:var(--accent-soft);stroke:var(--accent)}
  .sp-o{fill:var(--ext-soft);stroke:var(--ext)}
  .sp-u{fill:var(--warn-soft);stroke:var(--warn)}
  .sp-h{fill:var(--held-soft);stroke:var(--held)}
  .t-sp{font-family:"Archivo",sans-serif;font-size:14px;font-weight:600;fill:var(--ink);text-anchor:middle}
  .t-sp-s{font-family:"IBM Plex Mono",monospace;font-size:9px;fill:var(--ink-3);text-anchor:middle}
  .bcn{fill:var(--accent);stroke:var(--ground);stroke-width:2}
  .t-bcn{font-family:"IBM Plex Mono",monospace;font-size:10.5px;fill:var(--ink-2)}
  .fig-scroll svg{min-width:1000px}
  table{border-collapse:collapse;width:100%;font-size:.92rem;min-width:660px}
  caption{text-align:left;font-family:"Archivo",sans-serif;font-weight:600;font-size:1rem;
    padding:22px 0 8px;color:var(--ink)}
  th{font-family:"IBM Plex Mono",monospace;font-size:.71rem;letter-spacing:.09em;
    text-transform:uppercase;color:var(--ink-3);text-align:left;font-weight:500;
    border-bottom:1.5px solid var(--ink);padding:0 12px 7px 0}
  td{border-bottom:1px solid var(--line);padding:7px 12px 7px 0;vertical-align:top;color:var(--ink-2)}
  td:first-child{color:var(--ink);font-family:"IBM Plex Mono",monospace;font-size:.82rem}
  td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
  .tbl-scroll{overflow-x:auto;margin-top:14px}
</style>
"""
DEFS = u"""<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<marker id="ar5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)"/></marker></defs></svg>
"""

b=[];a=b.append
a(u'<div class="wrap">')
a(u'''<header class="mast">
  <div class="eyebrow">Palier · Documentation de conception · 5 / 5</div>
  <h1>Déploiement et matériel</h1>
  <p class="sub">Où s'exécute chaque composant, ce qui est installé dans le garage, et le montage physique exact de la démonstration.</p>
  <hr class="mast-rule">
</header>''')

a(u'''<section>
  <div class="sec-head"><h2>Diagramme de déploiement</h2><span class="tag">4 zones · 14 nœuds</span></div>
  <p class="lede">Quatre zones aux propriétés très différentes : les appareils que vous ne contrôlez pas, le nuage que vous contrôlez entièrement, les services tiers dont vous dépendez, et le garage, où le matériel tombe en panne et où le réseau est le plus incertain.</p>
  <figure><div class="fig"><div class="fig-scroll">%s</div>
  <figcaption>Le bloc en pointillé rappelle ce que le Wi-Fi du garage ne fournit pas — une confusion facile à commettre en présentation.</figcaption></div></figure>''' % rd('out/dep.svg'))

a(u'''<div class="note"><b>Le planificateur tourne en instance unique.</b>
  Deux instances exécutant <code>expire_holds</code> en parallèle libéreraient deux fois la même place, ou pire, annuleraient une session valide pendant qu'une autre instance la confirme. Un verrou consultatif Postgres suffit à le garantir — et c'est plus simple à défendre qu'un système de files.</div>''')
a(u'''<div class="note warn"><b>Le garage porte les deux pré-requis d'adhésion, et c'est la seule zone où une panne est invisible depuis le nuage.</b>
  Un parking rejoint le réseau à deux conditions : une couverture Wi-Fi aux paliers et aux deux bornes, et une barrière pilotable dont les boucles sont remontées — par contact sec, universel sur les opérateurs industriels, ou par l'API de son système de contrôle d'accès quand il en expose une. Palier n'installe pas de barrières ; il commande celles qui sont déjà là, et lit les boucles qu'elles ont déjà. Aucune caméra n'est exigée : la lecture de plaque ou de transpondeur est une option de confort de l'opérateur, jamais une condition. Troisième pré-requis : une couverture cellulaire mesurée aux deux bornes, parce que l'usager sans l'app ne rejoindra jamais le Wi-Fi du garage. Un contrôleur qui ne joint plus l'API refuse l'entrée et ouvre la sortie sans condition, en comptant localement.
  Une balise dont la pile est morte n'émet rien : aucune erreur, juste des confirmations qui n'arrivent plus. D'où le <code>heartbeat</code> des contrôleurs et la remontée du niveau de pile — sans eux, le premier symptôme d'une panne serait une plainte d'usager.</div>''')
a(u'</section>')

a(u'''<section>
  <div class="sec-head"><h2>Montage de la démonstration</h2><span class="tag">2 allées · 10 places · 3 balises</span></div>
  <p class="lede">Le prototype se démontre en environnement contrôlé. Les balises sont le seul matériel du montage : c'est le cœur technique, et une balise simulée ne prouverait rien du comportement en arrière-plan. Tout le reste — ouvertures de barrière comprises — se confirme dans l'application.</p>
  <figure><div class="fig"><div class="fig-scroll">%s</div>
  <figcaption>Dix places suffisent à montrer les six états, l'assignation par allée et le cas de la mauvaise place.</figcaption></div></figure>''' % rd('out/plan.svg'))

a(u'''<div class="tbl-scroll"><table>
  <caption>Matériel de la démonstration</caption>
  <thead><tr><th>Élément</th><th>Quantité</th><th>Rôle dans la démonstration</th></tr></thead>
  <tbody>
    <tr><td>Balises BLE</td><td class="num">3</td><td>Une par allée, une à la sortie, même <code>major</code>. Prouvent le <em>ranging</em> entre allées adjacentes, la survie de l'app trois minutes après le scan, la présomption de place et la sortie sans geste — le seul matériel non simulable</td></tr>
    <tr><td>QR imprimé</td><td class="num">1</td><td>Borne d'entrée. Aucun QR aux places ni à la sortie — c'était la décision de conception</td></tr>
    <tr><td>Console de démonstration</td><td class="num">1</td><td>Page web qui joue le contrôleur : boutons « boucle d'entrée fermée », « véhicule à la sortie », « boucle de sortie fermée », appelant l'API avec la clé d'appareil</td></tr>
    <tr><td>Matériel de barrière</td><td class="num">0</td><td>Aucun. Les ouvertures sont confirmées dans l'application ; la barrière ne prouve rien que le reste ne prouve déjà</td></tr>
    <tr><td>iPhone de test</td><td class="num">1</td><td>Démonstration au jury : arrière-plan plus prévisible qu'Android</td></tr>
    <tr><td>Étiquettes de places</td><td class="num">10</td><td>Numéros au sol ou au mur, sans marqueur scannable</td></tr>
  </tbody></table></div>''')

a(u'''<div class="note"><b>Ce que la démonstration ne montrera pas, et qu'il faut annoncer plutôt que laisser découvrir.</b>
  L'ouverture physique d'une barrière et la fermeture réelle d'une boucle : aucun matériel de barrière n'est monté, l'application affiche l'ouverture et la console joue les boucles. Les capteurs par place, option d'opérateur, ne sont pas montés. Le comportement Android non plus, puisque le module natif n'est pas livré au MVP. Les annoncer en ouverture vaut mieux que de se les faire signaler en question.</div>''')
a(u'</section>')

a(u'''<section>
  <div class="sec-head"><h2>Ordre de construction</h2><span class="tag">Ce qui débloque quoi</span></div>
  <p class="lede">Les dépendances entre chantiers imposent un ordre. Chaque étape rend la suivante démontrable.</p>
  <div class="tbl-scroll"><table>
    <thead><tr><th>Étape</th><th>Chantier</th><th>Débloque</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Schéma Postgres et machines à états, avec les tests de transition</td><td>Tout le reste. C'est aussi le seul chantier entièrement testable sans matériel</td></tr>
      <tr><td>2</td><td>Domaine : allocation atomique, tarification, holds</td><td>La séquence d'entrée, et la démonstration de la non-collision sous charge</td></tr>
      <tr><td>3</td><td>API et adaptateurs, Stripe en mode test</td><td>Le parcours complet en appels HTTP, sans app ni matériel</td></tr>
      <tr><td>4</td><td>Module natif iOS : survie après le scan, ranging, mouvement, avec le contrat du pont</td><td>Le mécanisme central — à faire tôt, c'est le risque technique du projet. Deux mesures à produire : trois minutes de survie écran éteint, et deux allées adjacentes distinguées</td></tr>
      <tr><td>5</td><td>Écrans React Native</td><td>La démonstration au jury</td></tr>
      <tr><td>6</td><td>Tableau de bord opérateur et adaptateur d'ouverture de barrière</td><td>Le récit complet, de l'adhésion d'un opérateur à la sortie du véhicule</td></tr>
    </tbody></table></div>
  <div class="note warn"><b>L'étape 4 avant l'étape 5, pas l'inverse.</b>
    L'ordre naturel serait de construire les écrans d'abord — c'est visible, c'est gratifiant. Mais le module natif est le seul chantier dont l'échec remettrait en cause la conception elle-même : si le réveil en arrière-plan ne fonctionne pas de façon fiable, la confirmation par tap doit être repensée. Découvrir cela à trois semaines de la remise serait fatal ; le découvrir tôt laisse le temps de basculer sur un mécanisme de repli.</div>
</section>''')

a(u'''<footer>
  <span>Palier · déploiement et matériel</span>
  <span>14 nœuds · 6 étapes de construction</span>
  <span>Document 5 de 5</span>
</footer>''')
a(u'</div>')

out = HEAD.replace(u'<title>Palier — Diagrammes de séquence</title>', u'<title>Palier — Déploiement et matériel</title>',1) + EXTRA + DEFS + u"\n".join(b)
io.open('../docs/05-deploiement.html','w',encoding='utf-8').write(out)
print('written', len(out))
