# -*- coding: utf-8 -*-
import io, os, subprocess

subprocess.check_call(['python3', 'merge.py'])
scoped = io.open('_scoped.css', encoding='utf-8').read()
raw = io.open('_articles.html', encoding='utf-8').read().split('\n<!--SPLIT-->\n')
arts = [x.split('\x00') for x in raw]

TOKENS = u"""
  :root{
    --ground:#EDEEEA; --surface:#F8F9F6; --surface-2:#E4E6E0;
    --ink:#191C1A; --ink-2:#4B534D; --ink-3:#6E766F;
    --line:#D2D6CE; --line-strong:#9BA298;
    --accent:#1B4B8F; --accent-soft:#DFE7F3; --accent-line:#1B4B8F;
    --store:#2E7D4F; --store-soft:#DFEEE6;
    --ext:#5A6159; --ext-soft:#E7E9E3;
    --held:#6C55A0; --held-soft:#E7E1F2;
    --warn:#A06407; --warn-soft:#F6EBD6;
    --stop:#9C3A2A; --stop-soft:#F4E1DD;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --ground:#121513; --surface:#1A1E1B; --surface-2:#242925;
      --ink:#E7EAE4; --ink-2:#AEB6AE; --ink-3:#8B948C;
      --line:#2C322D; --line-strong:#59615A;
      --accent:#8CB4E8; --accent-soft:#1C2A3A; --accent-line:#8CB4E8;
      --store:#63B487; --store-soft:#17281F;
      --ext:#A7AFA6; --ext-soft:#22261F;
      --held:#A38FD4; --held-soft:#231D33;
      --warn:#E0A63C; --warn-soft:#2E2410;
      --stop:#D9705E; --stop-soft:#331C18;
    }
  }
  :root[data-theme="dark"]{
    --ground:#121513; --surface:#1A1E1B; --surface-2:#242925;
    --ink:#E7EAE4; --ink-2:#AEB6AE; --ink-3:#8B948C;
    --line:#2C322D; --line-strong:#59615A;
    --accent:#8CB4E8; --accent-soft:#1C2A3A; --accent-line:#8CB4E8;
    --store:#63B487; --store-soft:#17281F;
    --ext:#A7AFA6; --ext-soft:#22261F;
    --held:#A38FD4; --held-soft:#231D33;
    --warn:#E0A63C; --warn-soft:#2E2410;
    --stop:#D9705E; --stop-soft:#331C18;
  }
"""

BASE = u"""
  *{box-sizing:border-box}
  body{background:var(--ground);color:var(--ink);
    font-family:"Newsreader",Georgia,serif;font-size:1.02rem;line-height:1.6;
    -webkit-font-smoothing:antialiased}
  .cover{max-width:1180px;margin:0 auto;padding:clamp(48px,9vw,110px) clamp(18px,4vw,40px) 0}
  .cover .eyebrow{font-family:"IBM Plex Mono",monospace;font-size:.78rem;letter-spacing:.16em;
    text-transform:uppercase;color:var(--ink-3)}
  .cover h1{font-family:"Archivo",system-ui,sans-serif;font-weight:700;letter-spacing:-.03em;
    line-height:.95;font-size:clamp(3rem,10vw,5.4rem);margin:.16em 0 .1em;text-wrap:balance}
  .cover .sub{color:var(--ink-2);max-width:60ch;margin:.5em 0 0;font-size:clamp(1.06rem,2.2vw,1.28rem)}
  .cover hr{height:6px;background:var(--ink);border:0;margin:clamp(30px,5vw,48px) 0 0}
  .cover hr::after{content:"";display:block;height:2px;background:var(--ink);margin-top:5px}
  .meta{display:flex;flex-wrap:wrap;gap:8px 30px;padding:16px 0 0;
    font-family:"IBM Plex Mono",monospace;font-size:.78rem;color:var(--ink-3)}
  .meta b{color:var(--ink-2);font-weight:500}

  .toc{max-width:1180px;margin:clamp(44px,7vw,72px) auto 0;
    padding:0 clamp(18px,4vw,40px);display:grid;gap:0}
  .toc a{display:grid;grid-template-columns:64px 1fr;gap:20px;align-items:baseline;
    text-decoration:none;color:inherit;border-top:1px solid var(--line);padding:16px 0}
  .toc a:last-of-type{border-bottom:1px solid var(--line)}
  .toc a:hover{background:var(--surface)}
  .toc a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  .toc .n{font-family:"IBM Plex Mono",monospace;font-size:.86rem;font-weight:600;color:var(--accent)}
  .toc .ti{font-family:"Archivo",sans-serif;font-weight:600;font-size:1.12rem;
    letter-spacing:-.01em;color:var(--ink)}
  .toc .ds{display:block;font-family:"Newsreader",serif;font-weight:400;font-size:.98rem;
    color:var(--ink-2);margin-top:3px}

  .part{max-width:1180px;margin:clamp(64px,10vw,110px) auto 0;
    padding:0 clamp(18px,4vw,40px)}
  .part-rule{height:4px;background:var(--ink);border:0;margin:0 0 22px}
  .part-n{font-family:"IBM Plex Mono",monospace;font-size:.78rem;letter-spacing:.16em;
    text-transform:uppercase;color:var(--accent)}
  .part h2{font-family:"Archivo",sans-serif;font-weight:700;letter-spacing:-.026em;
    font-size:clamp(1.9rem,4.6vw,2.7rem);line-height:1.02;margin:.2em 0 .12em;text-wrap:balance}
  .part p{color:var(--ink-2);max-width:64ch;margin:0;font-size:1.06rem}

  article > .wrap > section:first-of-type{margin-top:clamp(30px,4vw,44px)}
  .end{max-width:1180px;margin:clamp(60px,9vw,96px) auto 0;
    padding:18px clamp(18px,4vw,40px) 90px;border-top:2px solid var(--ink);
    font-family:"IBM Plex Mono",monospace;font-size:.78rem;color:var(--ink-3);
    display:flex;flex-wrap:wrap;gap:6px 26px}
  .end .top{margin-left:auto;color:var(--accent);text-decoration:none}
  .end .top:hover{text-decoration:underline}

  @media print{
    body{background:#fff;color:#000}
    .toc a{break-inside:avoid}
    .part{break-before:page}
    .fig{border:1px solid #999;break-inside:avoid}
    section{break-inside:avoid-page}
  }
"""

# les titres de section sont passes en h3 : leur redonner l'allure d'un titre de section
SECH3 = "\n".join(
    u'#%s .sec-head h3{font-family:"Archivo",sans-serif;font-weight:600;font-size:1.42rem;'
    u'letter-spacing:-.02em;margin:0;line-height:1.15}' % a[0] for a in arts)

HEAD = u"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Palier — Dossier de conception</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap">
<style>%s%s%s
%s
</style>
""" % (TOKENS, BASE, SECH3, scoped)

o = [HEAD]
o.append(u"""<div class="cover">
  <div class="eyebrow">Dossier de conception · cinq documents</div>
  <h1>Palier</h1>
  <p class="sub">Système d'allocation de places en stationnement intérieur, multi-opérateurs. Une place assignée à l'entrée, un guidage par balises, une facturation fermée à la sortie.</p>
  <hr>
  <div class="meta">
    <span><b>30</b> décisions tranchées</span>
    <span><b>12</b> entités · <b>2</b> machines à états</span>
    <span><b>23</b> endpoints</span>
    <span><b>13</b> diagrammes</span>
    <span>Aucune ligne de code écrite</span>
  </div>
</div>
<nav class="toc" aria-label="Sommaire">""")
for did, title, sub, _ in arts:
    o.append(u'  <a href="#%s"><span class="n">%s</span><span class="ti">%s<span class="ds">%s</span></span></a>'
             % (did, did[1:].zfill(2), title, sub))
o.append(u'</nav>')

for did, title, sub, body in arts:
    o.append(u'<article id="%s">' % did)
    o.append(u'''  <div class="part">
    <hr class="part-rule">
    <div class="part-n">Document %s sur 5</div>
    <h2>%s</h2>
    <p>%s</p>
  </div>''' % (did[1:], title, sub))
    o.append(body)
    o.append(u'</article>')

o.append(u"""<div class="end">
  <span>Palier · dossier de conception complet</span>
  <span>5 documents réunis en une page</span>
  <a class="top" href="#">Retour au sommaire</a>
</div>""")

out = u"\n".join(o)
io.open('../docs/palier-dossier-complet.html', 'w', encoding='utf-8').write(out)
print('ecrit', len(out), 'octets')
