# -*- coding: utf-8 -*-
import io

def rd(p):
    return io.open(p, encoding='utf-8').read()

CSS = rd('../_shared.css') if False else ""

HEAD = u"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Palier — Diagrammes de séquence</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap">
<style>
  :root{
    --ground:#EDEEEA; --surface:#F8F9F6; --surface-2:#E4E6E0;
    --ink:#191C1A; --ink-2:#4B534D; --ink-3:#6E766F;
    --line:#D2D6CE; --line-strong:#9BA298;
    --accent:#1B4B8F; --accent-soft:#DFE7F3;
    --store:#2E7D4F; --store-soft:#DFEEE6;
    --ext:#5A6159; --ext-soft:#E7E9E3;
    --held:#6C55A0; --held-soft:#E7E1F2;
    --warn:#A06407; --warn-soft:#F6EBD6;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --ground:#121513; --surface:#1A1E1B; --surface-2:#242925;
      --ink:#E7EAE4; --ink-2:#AEB6AE; --ink-3:#8B948C;
      --line:#2C322D; --line-strong:#59615A;
      --accent:#8CB4E8; --accent-soft:#1C2A3A;
      --store:#63B487; --store-soft:#17281F;
      --ext:#A7AFA6; --ext-soft:#22261F;
      --held:#A38FD4; --held-soft:#231D33;
      --warn:#E0A63C; --warn-soft:#2E2410;
    }
  }
  :root[data-theme="dark"]{
    --ground:#121513; --surface:#1A1E1B; --surface-2:#242925;
    --ink:#E7EAE4; --ink-2:#AEB6AE; --ink-3:#8B948C;
    --line:#2C322D; --line-strong:#59615A;
    --accent:#8CB4E8; --accent-soft:#1C2A3A;
    --store:#63B487; --store-soft:#17281F;
    --ext:#A7AFA6; --ext-soft:#22261F;
    --held:#A38FD4; --held-soft:#231D33;
    --warn:#E0A63C; --warn-soft:#2E2410;
  }
  *{box-sizing:border-box}
  body{background:var(--ground);color:var(--ink);
    font-family:"Newsreader",Georgia,serif;font-size:1.02rem;line-height:1.6;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:1180px;margin:0 auto;padding:0 clamp(18px,4vw,40px) 90px}
  header.mast{padding:clamp(44px,8vw,88px) 0 0}
  .eyebrow{font-family:"IBM Plex Mono",monospace;font-size:.78rem;letter-spacing:.16em;
    text-transform:uppercase;color:var(--ink-3)}
  h1{font-family:"Archivo",system-ui,sans-serif;font-weight:700;letter-spacing:-.028em;
    line-height:1;font-size:clamp(2.2rem,6vw,3rem);margin:.3em 0 .15em;text-wrap:balance}
  .sub{color:var(--ink-2);max-width:64ch;margin:.4em 0 0;font-size:1.1rem}
  .mast-rule{height:5px;background:var(--ink);margin:30px 0 0;border:0}
  .mast-rule::after{content:"";display:block;height:2px;background:var(--ink);margin-top:4px}
  section{margin-top:clamp(46px,7vw,74px)}
  .sec-head{display:flex;align-items:baseline;gap:16px;border-bottom:2px solid var(--ink);
    padding-bottom:9px;margin-bottom:22px;flex-wrap:wrap}
  .sec-head h2{font-family:"Archivo",sans-serif;font-weight:600;font-size:1.5rem;
    letter-spacing:-.02em;margin:0}
  .sec-head .tag{margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:.78rem;
    color:var(--ink-3);letter-spacing:.08em;text-transform:uppercase}
  .lede{max-width:70ch;color:var(--ink-2);margin:0 0 24px}
  figure{margin:0}
  .fig{background:var(--surface);border:1px solid var(--line);border-radius:3px;
    padding:16px 8px 8px}
  .fig-scroll{overflow-x:auto;overflow-y:hidden}
  .fig-scroll svg{display:block;height:auto;min-width:1000px;width:100%}
  figcaption{font-family:"IBM Plex Mono",monospace;font-size:.8rem;color:var(--ink-3);
    padding:12px 14px 4px;line-height:1.6}
  .ll{stroke:var(--line-strong);stroke-width:1.2;stroke-dasharray:4 5}
  .p{stroke-width:1.9}
  .p-ext{fill:var(--ext-soft);stroke:var(--ext)}
  .p-app{fill:var(--accent-soft);stroke:var(--accent)}
  .p-api{fill:var(--accent-soft);stroke:var(--accent);stroke-width:2.8}
  .p-db{fill:var(--store-soft);stroke:var(--store)}
  .p-svc{fill:var(--held-soft);stroke:var(--held)}
  .t-p{font-family:"Archivo",sans-serif;font-size:13px;font-weight:600;fill:var(--ink)}
  .t-ps{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:var(--ink-3)}
  .msg{fill:none;stroke:var(--ink-2);stroke-width:1.6}
  .ret{fill:none;stroke:var(--ink-3);stroke-width:1.5;stroke-dasharray:6 4}
  .frm{fill:none;stroke:var(--warn);stroke-width:1.4}
  .frm-tab{fill:var(--warn-soft);stroke:var(--warn);stroke-width:1.4}
  .frm-sep{stroke:var(--warn);stroke-width:1.2;stroke-dasharray:5 4}
  .t-frag{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;fill:var(--warn)}
  .t-frag-s{font-family:"IBM Plex Mono",monospace;font-size:10.5px;fill:var(--ink-3)}
  .t-msg{font-family:"IBM Plex Mono",monospace;font-size:11px;fill:var(--ink-2)}
  .found{fill:var(--ink-2)}
  .note{background:var(--surface);border-left:3px solid var(--accent);border-radius:0 3px 3px 0;
    padding:14px 18px;margin-top:20px;color:var(--ink-2);font-size:.96rem;max-width:78ch}
  .note.warn{border-left-color:var(--warn)}
  .note b{color:var(--ink);font-weight:500}
  code{font-family:"IBM Plex Mono",monospace;font-size:.84em;background:var(--surface-2);
    padding:1px 5px;border-radius:2px;color:var(--ink)}
  .key{display:flex;flex-wrap:wrap;gap:8px 22px;margin:0 0 26px;padding:0;list-style:none;
    font-family:"IBM Plex Mono",monospace;font-size:.8rem;color:var(--ink-3)}
  .key li{display:flex;align-items:center;gap:8px}
  .key i{width:26px;height:0;border-top-width:2px;display:inline-block}
  footer{margin-top:70px;border-top:2px solid var(--ink);padding-top:16px;
    font-family:"IBM Plex Mono",monospace;font-size:.78rem;color:var(--ink-3);
    display:flex;flex-wrap:wrap;gap:6px 24px}
  @media print{body{background:#fff;color:#000}.wrap{max-width:none;padding:0}
    .fig{border:1px solid #999;break-inside:avoid}section{break-inside:avoid-page}}
</style>
"""

DEFS = u"""<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<marker id="sq" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--ink-2)"/></marker></defs></svg>
"""

def fig(svg, cap):
    return u'<figure><div class="fig"><div class="fig-scroll">%s</div><figcaption>%s</figcaption></div></figure>' % (svg, cap)

body = []
b = body.append
b(u'<div class="wrap">')
b(u'''<header class="mast">
  <div class="eyebrow">Palier · Documentation de conception · 3 / 5</div>
  <h1>Diagrammes de séquence</h1>
  <p class="sub">Les quatre parcours où plusieurs systèmes se coordonnent et où l'ordre des appels est une décision de conception, pas un détail d'implémentation.</p>
  <hr class="mast-rule">
</header>''')

b(u'''<section>
  <div class="sec-head"><h2>Séquence A — Entrée au parking</h2><span class="tag">7 participants · 18 messages</span></div>
  <p class="lede">Le parcours le plus contraint du système : quatre sous-systèmes doivent réussir dans un ordre précis pendant qu'une voiture attend devant une barrière, avec une file derrière elle.</p>
  <ul class="key">
    <li><i style="border-top:2px solid var(--ink-2)"></i> appel</li>
    <li><i style="border-top:2px dashed var(--ink-3)"></i> retour</li>
    <li><span style="color:var(--warn)">▭</span> fragment conditionnel</li>
  </ul>''')
b(fig(rd('out/seq_A.svg'), u"L'assignation précède l'appel à Stripe, et la pré-autorisation précède l'ouverture de la barrière."))
b(u'''<div class="note"><b>Trois contraintes d'ordre, et ce qui casse si on les inverse.</b>
  L'assignation vient <b>avant</b> Stripe : appeler Stripe pour un parking complet coûte une latence inutile et une pré-autorisation à annuler.
  La pré-autorisation vient <b>avant</b> l'ouverture : une carte refusée après l'ouverture de la barrière est irrattrapable, la voiture est déjà entrée.
  La preuve d'entrée vient <b>après</b> l'ouverture, par construction : c'est la fermeture de la boucle sous la lisse qui la donne. Aucune caméra n'intervient, la boucle détecte tout véhicule, plaque enneigée ou non. Le premier fragment montre les deux populations : l'app, ou un navigateur qui pré-autorise par Apple Pay sans compte. Les deux consomment le même jeton de borne.</div>''')
b(u'''<div class="note warn"><b>Le fragment conditionnel porte tout le risque de cette séquence.</b>
  La branche « aucun passage 60 s après l'ouverture » n'est pas déclenchée par un acteur mais par la tâche <code>cancel_unconfirmed_entries</code>. Elle couvre la barrière en panne et le conducteur qui recule — pas la plaque illisible, qui n'existe plus comme cas. Elle doit annuler <b>deux</b> choses : l'état de la place et la pré-autorisation Stripe. Oublier la seconde laisse un montant bloqué sur la carte d'un conducteur qui n'est jamais entré.</div>
<div class="tbl-scroll"><table>
  <caption>Budget temps d'une visite type, barrière et passage compris</caption>
  <thead><tr><th>Étape</th><th>Stationnement classique</th><th>Palier</th></tr></thead>
  <tbody>
    <tr><td>Savoir avant de partir</td><td>Inconnu ; 10 à 20 % de risque d'un « complet » et d'un détour de 5 à 10 min</td><td>Connu dans l'app, le hold garantit la place</td></tr>
    <tr><td>Barrière d'entrée</td><td>9 s : bouton, billet, barrière</td><td>10 s avec le scanner armé par la balise, 15 à 21 s téléphone dans le sac</td></tr>
    <tr><td>Trouver une place</td><td>2 à 5 min à parcourir les paliers</td><td>1 à 1,5 min vers la place assignée</td></tr>
    <tr><td>Retrouver la voiture</td><td>30 s à 2 min</td><td>L'app connaît la place</td></tr>
    <tr><td>Payer</td><td>1 à 2 min à la caisse, ou 20 à 30 s à la voie</td><td>Aucun geste</td></tr>
    <tr><td>Barrière de sortie</td><td>8 à 10 s billet en main, 20 à 30 s en payant à la voie</td><td>7 s sans geste, 12 à 18 s avec un scan</td></tr>
    <tr><td>Total de friction</td><td>5 à 9 min</td><td>1,5 à 2,5 min</td></tr>
  </tbody></table></div>
<div class="note"><b>Le temps par usager n'est pas le risque, la capacité de la voie l'est.</b>
  Une voie qui reçoit 300 véhicules à l'heure tourne à 75 % avec un cycle de 9 s et sature au-delà de 12 s. D'où le scanner armé par la balise d'entrée : déverrouillage et lancement de l'app se font en roulant vers la borne, il ne reste que viser et scanner. Le contrôleur horodate l'arrivée sur la boucle d'armement et la fermeture de la boucle : le prototype mesure lui-même ce tableau.</div>''')
b(u'</section>')

b(u'''<section>
  <div class="sec-head"><h2>Séquence B — Confirmation de la place</h2><span class="tag">7 participants · 18 messages</span></div>
  <p class="lede">Le mécanisme central du produit, et au cas nominal il ne demande rien à personne : le <em>ranging</em> des balises donne l'allée, le capteur de mouvement donne l'instant, l'app est vivante depuis le scan, et si l'allée est celle de la place assignée, la place est présumée occupée. L'usager n'est sollicité que lorsque les signaux se contredisent.</p>''')
b(fig(rd('out/seq_B.svg'), u"Les trois branches du fragment : présomption silencieuse, allée contradictoire, place prise. Seules les deux dernières font apparaître l'usager."))
b(u'''<div class="note"><b>Les deux branches d'exception sont des opérations à deux écritures.</b>
  Quand l'allée détectée contredit l'assignation, la place assignée passe à <code>OCCUPIED_UNKNOWN</code> avant même que l'usager réponde, et la place qu'il désigne passe à <code>OCCUPIED</code> ensuite. Quand il signale une place prise, la place signalée passe à <code>OCCUPIED_UNKNOWN</code> et une nouvelle place à <code>ASSIGNED</code> dans la même transaction. Hors transaction, une coupure réseau entre les deux laisse une place fantôme, réservée pour personne et invisible à l'inventaire.</div>''')
b(u'''<div class="note warn"><b>La présomption est une décision, pas une approximation.</b>
  Le système écrit <code>PARKED_PRESUMED</code> et <code>OCCUPIED</code> sur la seule foi du signal <em>walking</em> dans la bonne allée. Le risque accepté : un usager qui change d'allée après la transition sans être détecté. Le compteur de passages borne l'erreur cumulée, et la tâche <code>reconcile_counts</code> la rend visible. L'alternative — demander un tap à chaque stationnement — coûtait un geste à tout le monde pour corriger une erreur rare.</div>''')
b(u'</section>')

b(u'''<section>
  <div class="sec-head"><h2>Séquence C — Sortie et facturation</h2><span class="tag">6 participants · 17 messages</span></div>
  <p class="lede">Trois façons d'identifier le véhicule qui sort, de la plus automatique à la moins, chacune ne servant que si la précédente échoue : lecture de plaque ou de transpondeur chez les opérateurs équipés, balise de sortie vue par l'app, scan du QR de sortie. Le scan vaut pour l'app comme pour la page web sans compte, retrouvée par son jeton. Les deux premières ne demandent aucun geste. Aucune ne dépend d'une caméra, et la boucle ferme la session dans tous les cas.</p>''')
b(fig(rd('out/seq_C.svg'), u"Quelle que soit la branche d'identification, la suite est identique : capture, ouverture, boucle. Un téléphone déchargé tombe hors des trois branches — c'est le cas du ticket perdu, réglé par le personnel."))
b(u'''<div class="note"><b>La règle non négociable : jamais d'ouverture sans autorisation valide — et elle est garantie à l'entrée.</b>
  Le montant capturé est toujours couvert par le plafond pré-autorisé, et la session est plafonnée à 24 h, donc un refus de carte à la sortie n'existe pas. Si Stripe est injoignable à l'instant de la capture, la barrière ouvre quand même : les fonds sont bloqués, la tâche <code>retry_captures</code> rejoue la capture, le reçu part au succès. Le coût de cette règle est une latence de quelques centaines de millisecondes, absorbée par le temps que met le conducteur à avancer jusqu'à la barrière après son identification.</div>
<div class="note warn"><b>L'ouverture par balise exige deux conditions, pas une.</b>
  Une seule session active du parking doit avoir signalé la balise de sortie dans la dernière minute, <b>et</b> un véhicule doit être présent sur la boucle d'armement. La première évite d'ouvrir pour la voiture d'en face ; la seconde évite d'ouvrir pour un piéton qui passe devant la sortie avec l'app. Deux téléphones candidats → repli sur le scan, jamais un pari.</div>
<div class="note"><b>La page web retrouve sa session sans rien demander.</b>
  Le jeton est conservé trois fois dès l'entrée : cookie de 30 jours, passe Wallet portant le QR de sortie, lien par SMS ou courriel. Le numéro de place seul n'est jamais accepté : n'importe qui le lit au sol et ferait payer la session d'un autre. Les trois supports perdus, c'est le billet perdu : le personnel. Une session sans sortie après sept jours n'est jamais facturée d'office ; elle part en vérification.</div>''')
b(u'</section>')

b(u'''<section>
  <div class="sec-head"><h2>Séquence D — Adhésion d'un opérateur</h2><span class="tag">5 participants · 14 messages</span></div>
  <p class="lede">Le seul parcours asynchrone du système : la vérification d'identité se déroule chez Stripe, hors de l'application, et revient par un webhook qui peut arriver des minutes ou des jours plus tard.</p>''')
b(fig(rd('out/seq_D.svg'), u"Le KYC se fait sur une page hébergée par Stripe ; l'API n'en voit que le résultat, par webhook."))
b(u'''<div class="note"><b>Deux verrous empêchent un parking d'être mis en ligne à moitié configuré.</b>
  L'API refuse l'enregistrement d'une politique tarifaire sans plafond journalier, parce que c'est ce montant qui est pré-autorisé à l'entrée. Et un parking dont <code>wifi_verified_at</code> est nul reste hors ligne, quel que soit l'état de sa configuration : sans réseau au sous-sol, la confirmation de place ne remonterait jamais.</div>''')
b(u'</section>')

b(u'''<footer>
  <span>Palier · diagrammes de séquence</span>
  <span>4 parcours · 67 messages</span>
  <span>Document 3 de 5</span>
</footer>''')
b(u'</div>')

out = HEAD + DEFS + u"\n".join(body)
io.open('../docs/03-sequences.html','w',encoding='utf-8').write(out)
print('written', len(out))
