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
  <div class="sec-head"><h2>Séquence A — Entrée au parking</h2><span class="tag">7 participants · 17 messages</span></div>
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
  La lecture de plaque vient <b>après</b> l'ouverture, et ce n'est pas un choix — la caméra vise la plaque arrière, donc elle ne voit le véhicule qu'une fois la barrière franchie.</div>''')
b(u'''<div class="note warn"><b>Le fragment conditionnel porte tout le risque de cette séquence.</b>
  La branche « aucune plaque lue après 2 min » n'est pas déclenchée par un acteur mais par la tâche <code>cancel_unconfirmed_entries</code>. Elle doit annuler <b>deux</b> choses : l'état de la place et la pré-autorisation Stripe. Oublier la seconde laisse un montant bloqué sur la carte d'un conducteur qui n'est jamais entré.</div>''')
b(u'</section>')

b(u'''<section>
  <div class="sec-head"><h2>Séquence B — Confirmation de la place</h2><span class="tag">7 participants · 15 messages</span></div>
  <p class="lede">Le mécanisme central du produit. Rien n'est déclenché par un minuteur : c'est la balise qui réveille l'app, et le capteur de mouvement qui décide du moment de la notification.</p>''')
b(fig(rd('out/seq_B.svg'), u"Les trois branches du fragment correspondent aux trois issues réelles : confirmation, correction, silence."))
b(u'''<div class="note"><b>La correction de place est la seule opération à deux écritures.</b>
  Quand l'utilisateur saisit un autre numéro, deux lignes de <code>spot</code> changent d'état dans la même transaction : la place réelle passe à <code>OCCUPIED</code>, l'ancienne à <code>OCCUPIED_UNKNOWN</code>. Hors transaction, une coupure réseau entre les deux laisse une place fantôme, réservée pour personne et invisible à l'inventaire.</div>''')
b(u'''<div class="note warn"><b>La branche « aucune réponse » n'a pas de message entrant.</b>
  Elle se produit sans qu'aucun acteur n'agisse : le système écrit <code>PARKED_UNCONFIRMED</code> sur la seule foi du signal <em>walking</em>. C'est délibéré — attendre la confirmation pour écrire laisserait la place bloquée indéfiniment.</div>''')
b(u'</section>')

b(u'''<section>
  <div class="sec-head"><h2>Séquence C — Sortie et facturation</h2><span class="tag">7 participants · 13 messages</span></div>
  <p class="lede">Le cas nominal ne comporte aucun geste de l'utilisateur : la plaque déclenche toute la chaîne. Le chemin de repli n'existe que pour les lectures ratées et les sessions marquées <code>plate_mismatch</code>.</p>''')
b(fig(rd('out/seq_C.svg'), u"La capture du paiement précède l'ouverture de la barrière, sans exception."))
b(u'''<div class="note"><b>Une seule règle non négociable ici : la barrière n'ouvre jamais avant que Stripe ait confirmé la capture.</b>
  Ouvrir d'abord pour fluidifier le trafic transformerait chaque échec de capture en perte sèche, sans recours — le véhicule est parti. Le coût de cette règle est une latence de quelques centaines de millisecondes, absorbée par le temps que met le conducteur à avancer jusqu'à la barrière après la lecture de sa plaque.</div>''')
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
  <span>4 parcours · 59 messages</span>
  <span>Document 3 de 5</span>
</footer>''')
b(u'</div>')

out = HEAD + DEFS + u"\n".join(body)
io.open('../docs/03-sequences.html','w',encoding='utf-8').write(out)
print('written', len(out))
