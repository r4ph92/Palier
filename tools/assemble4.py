# -*- coding: utf-8 -*-
import io
from assemble3 import HEAD  # reuse palette + base CSS

def rd(p): return io.open(p, encoding='utf-8').read()

EXTRA = u"""<style>
  .bd{fill:none;stroke:var(--line-strong);stroke-width:1.5;stroke-dasharray:6 5}
  .bd-warn{stroke:var(--warn)}
  .bd-accent{stroke:var(--accent);stroke-dasharray:none;stroke-width:2}
  .bd-muted{stroke:var(--line)}
  .t-band{font-family:"Archivo",sans-serif;font-size:14px;font-weight:600;fill:var(--ink)}
  .t-band-s{font-family:"IBM Plex Mono",monospace;font-size:10.5px;fill:var(--ink-3)}
  .cmp{fill:var(--surface-2);stroke:var(--ink-3);stroke-width:1.6}
  .cmp-warn{fill:var(--warn-soft);stroke:var(--warn)}
  .cmp-accent{fill:var(--accent-soft);stroke:var(--accent);stroke-width:1.8}
  .cmp-muted{fill:none;stroke:var(--line);stroke-dasharray:5 4}
  .t-cmp{font-family:"Archivo",sans-serif;font-size:13px;font-weight:600;fill:var(--ink)}
  .t-cmp-s{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:var(--ink-3)}
  .t-code{font-family:"IBM Plex Mono",monospace;font-size:10.5px;fill:var(--ink-2)}
  .dep{fill:none;stroke:var(--line-strong);stroke-width:1.6}
  .dep-up{stroke:var(--warn)}
  .t-dep{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:var(--ink-3);letter-spacing:.05em}
  .fig-scroll svg{min-width:1120px}
  table{min-width:700px}
  td:first-child{color:var(--ink);font-family:"IBM Plex Mono",monospace;font-size:.82rem}
  caption{text-align:left;font-family:"Archivo",sans-serif;font-weight:600;font-size:1rem;
    padding:22px 0 8px;color:var(--ink)}
  th{font-family:"IBM Plex Mono",monospace;font-size:.71rem;letter-spacing:.09em;
    text-transform:uppercase;color:var(--ink-3);text-align:left;font-weight:500;
    border-bottom:1.5px solid var(--ink);padding:0 12px 7px 0}
  td{border-bottom:1px solid var(--line);padding:7px 12px 7px 0;vertical-align:top;color:var(--ink-2)}
  table{border-collapse:collapse;width:100%;font-size:.92rem}
  .tbl-scroll{overflow-x:auto;margin-top:14px}
</style>
"""

DEFS = u"""<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<marker id="ar4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)"/></marker></defs></svg>
"""

b = []
a = b.append
a(u'<div class="wrap">')
a(u'''<header class="mast">
  <div class="eyebrow">Palier · Documentation de conception · 4 / 5</div>
  <h1>Architecture applicative</h1>
  <p class="sub">Le découpage en composants de l'API et de l'application mobile, et le contrat exact de la frontière entre le code TypeScript et les modules natifs — l'endroit où ce projet peut déraper.</p>
  <hr class="mast-rule">
</header>''')

a(u'''<section>
  <div class="sec-head"><h2>API — architecture en couches</h2><span class="tag">4 couches · 21 composants</span></div>
  <p class="lede">Le domaine ne connaît ni HTTP ni Stripe : il reçoit des objets et rend des décisions. C'est ce qui rend la logique d'allocation testable sans base de données ni réseau, et c'est la seule partie du système qu'un correcteur peut lire d'un bout à l'autre.</p>
  <figure><div class="fig"><div class="fig-scroll">%s</div>
  <figcaption>Le planificateur est la seule couche qui remonte : il appelle le domaine sans passer par HTTP.</figcaption></div></figure>''' % rd('out/cmp_api.svg'))

a(u'''<div class="note"><b>Pourquoi le planificateur est dessiné à part.</b>
  Les six tâches ne sont pas des détails d'exploitation : ce sont les transitions déclenchées par le temps, et elles portent quatre des règles métier les plus importantes du système — l'expiration d'un hold, l'annulation d'une entrée jamais passée, le garde-fou contre le téléphone déchargé, la réconciliation du compteur avec les places, la mise en vérification des sessions sans sortie. Les enfouir dans un <code>cron</code> les rendrait invisibles à la lecture du code.</div>''')

a(u'''<div class="tbl-scroll"><table>
  <caption>Ce que chaque composant du domaine décide</caption>
  <thead><tr><th>Composant</th><th>Décision</th><th>Ce qu'il ne fait pas</th></tr></thead>
  <tbody>
    <tr><td>Allocation</td><td>Quelle place attribuer : filtre par attributs du véhicule, puis palier et allée selon la stratégie du parking</td><td>N'ouvre pas la barrière et n'appelle pas Stripe</td></tr>
    <tr><td>Sessions</td><td>Transitions de la machine à états, présomption de place à partir de l'allée détectée, rapprochement de l'identité lue à la sortie, réassignation sur « place prise »</td><td>Ne calcule aucun montant</td></tr>
    <tr><td>Tarification</td><td>Montant dû à partir de la durée et de la politique du parking ; valide la présence du plafond journalier</td><td>Ne parle jamais à Stripe</td></tr>
    <tr><td>Holds</td><td>Accorde ou refuse un hold selon le quota du parking et la règle « un seul par usager »</td><td>N'écrit pas directement dans <code>spot</code></td></tr>
    <tr><td>Occupation</td><td>Agrégats par palier et par état, compteur de passages, écart entre les deux et liste des places à vérifier</td><td>N'anonymise pas — c'est la tâche de purge</td></tr>
  </tbody></table></div>
</section>''')

a(u'''<section>
  <div class="sec-head"><h2>Application mobile — architecture</h2><span class="tag">React Native + modules natifs</span></div>
  <p class="lede">Une seule base de code TypeScript, deux implémentations natives de la même frontière. Le noyau applicatif ignore complètement quelle plateforme lui envoie les événements.</p>
  <figure><div class="fig"><div class="fig-scroll">%s</div>
  <figcaption>Les modules Android sont dessinés en pointillé : le contrat existe, l'implémentation vient après le MVP.</figcaption></div></figure>''' % rd('out/cmp_mobile.svg'))

a(u'''<div class="note"><b>Le contrat du pont est le livrable le plus important de cette page.</b>
  Quatre commandes descendent, quatre événements remontent. Tant que ces huit signatures ne changent pas, l'implémentation Android peut être écrite des mois plus tard sans toucher une ligne de TypeScript. Si elles sont improvisées au fil de l'implémentation iOS, elles porteront les hypothèses d'iOS — les régions iBeacon, la limite de vingt, le réveil d'app terminée — et Android devra être plaqué par-dessus.</div>''')

a(u'''<div class="note warn"><b>Une asymétrie à assumer dès l'écriture du contrat.</b>
  Sur iOS, l'app reste vivante entre le scan et la présomption grâce aux mises à jour de localisation en arrière-plan — c'est le rôle de <code>keepAlive</code>, qui exige la permission « Toujours ». Sur Android, le même effet vient d'un service de premier plan. Le contrat nomme la commande sans dire comment chaque plateforme l'honore ; c'est ce qui permet d'écrire Kotlin plus tard sans toucher au TypeScript.</div>''')

a(u'''<div class="tbl-scroll"><table>
  <caption>Répartition du travail par surface</caption>
  <thead><tr><th>Surface</th><th>Technologie</th><th>Portée MVP</th></tr></thead>
  <tbody>
    <tr><td>Application mobile</td><td>React Native · TypeScript</td><td>Écrans complets, module natif iOS seulement</td></tr>
    <tr><td>Module balises / mouvement</td><td>Swift (iOS) · Kotlin (Android)</td><td>iOS livré ; Android spécifié, non implémenté</td></tr>
    <tr><td>API</td><td>TypeScript · Postgres</td><td>Complète, y compris le planificateur</td></tr>
    <tr><td>Tableau de bord opérateur</td><td>Web · types partagés avec l'API</td><td>Onboarding Connect, tarifs, plan, occupation. Pas d'analytique</td></tr>
    <tr><td>Adaptateur d'ouverture de barrière</td><td>Contact sec ou API du contrôle d'accès</td><td>Spécifié, non câblé : la démonstration confirme les ouvertures dans l'application</td></tr>
  </tbody></table></div>
</section>''')

a(u'''<footer>
  <span>Palier · architecture applicative</span>
  <span>2 diagrammes de composants · 8 signatures de pont</span>
  <span>Document 4 de 5</span>
</footer>''')
a(u'</div>')

out = HEAD.replace(u'<title>Palier \u2014 Diagrammes de s\u00e9quence</title>', u'<title>Palier \u2014 Architecture applicative</title>', 1) + EXTRA + DEFS + u"\n".join(b)
io.open('../docs/04-architecture.html','w',encoding='utf-8').write(out)
print('written', len(out))
