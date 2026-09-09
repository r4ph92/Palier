# -*- coding: utf-8 -*-
"""Fusionne les cinq documents en une page unique, en isolant le CSS de chacun."""
import io, os, re

DOCS = [
    ("d1", "01-flux-de-donnees.html",  u"Flux de données",
     u"Diagramme de contexte et décomposition de niveau 1"),
    ("d2", "02-modele-de-donnees.html", u"Modèle de données et états",
     u"Douze entités, deux machines à états, la surface API"),
    ("d3", "03-sequences.html",         u"Diagrammes de séquence",
     u"Quatre parcours où l'ordre des appels est une décision"),
    ("d4", "04-architecture.html",      u"Architecture applicative",
     u"Couches de l'API, app React Native, contrat du pont natif"),
    ("d5", "05-deploiement.html",       u"Déploiement et matériel",
     u"Quatre zones d'exécution, montage de démonstration, ordre de construction"),
]

def read(p):
    return io.open(p, encoding='utf-8').read()

def match_block(s, i):
    """i pointe sur '{' ; renvoie l'index juste apres le '}' correspondant."""
    depth = 0
    while i < len(s):
        if s[i] == '{':
            depth += 1
        elif s[i] == '}':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return len(s)

DROP_AT = re.compile(r'@media\s*\(prefers-color-scheme[^{]*|@media\s+print[^{]*')
DROP_SEL = re.compile(r'^(\*|body|html|:root(\[[^\]]*\])?(:not\([^)]*\))?)$')

def prefix_css(css, scope):
    out = []
    i = 0
    n = len(css)
    while i < n:
        # commentaire
        if css.startswith('/*', i):
            j = css.find('*/', i)
            i = (j + 2) if j != -1 else n
            continue
        if css[i] in ' \n\t\r;':
            i += 1
            continue
        if css[i] == '@':
            head_end = css.find('{', i)
            if head_end == -1:
                break
            head = css[i:head_end].strip()
            end = match_block(css, head_end)
            inner = css[head_end + 1:end - 1]
            if DROP_AT.match(head):
                i = end
                continue
            out.append('%s{\n%s\n}' % (head, prefix_css(inner, scope)))
            i = end
            continue
        brace = css.find('{', i)
        if brace == -1:
            break
        sel = css[i:brace].strip()
        end = match_block(css, brace)
        body = css[brace + 1:end - 1].strip()
        parts = []
        for s in sel.split(','):
            s = s.strip()
            if not s:
                continue
            if DROP_SEL.match(s):
                parts = []
                break
            parts.append('%s %s' % (scope, s))
        if parts:
            out.append('%s{%s}' % (', '.join(parts), body))
        i = end
    return '\n'.join(out)

tokens = None
scoped = []
articles = []

for did, fname, title, sub in DOCS:
    src = read(os.path.join('..', 'docs', fname))
    styles = re.findall(r'<style>(.*?)</style>', src, re.S)
    if tokens is None:
        m = re.search(r'(:root\{.*?\}\s*@media \(prefers-color-scheme: dark\)\{.*?\n  \}\s*\}\s*:root\[data-theme="dark"\]\{.*?\})', styles[0], re.S)
        tokens = m.group(1) if m else ''
    css = '\n'.join(styles)
    scoped.append('/* ===== %s ===== */\n%s' % (did, prefix_css(css, '#' + did)))

    body = src[src.rindex('</style>') + len('</style>'):]
    body = re.sub(r'<header class="mast">.*?</header>', '', body, flags=re.S)
    body = re.sub(r'<footer>.*?</footer>', '', body, flags=re.S)
    body = re.sub(r'(<div class="sec-head">)<h2>(.*?)</h2>', r'\1<h3>\2</h3>', body, flags=re.S)
    articles.append((did, title, sub, body.strip()))

io.open('_tokens.css', 'w', encoding='utf-8').write(tokens)
io.open('_scoped.css', 'w', encoding='utf-8').write('\n'.join(scoped))
io.open('_articles.html', 'w', encoding='utf-8').write(
    '\n<!--SPLIT-->\n'.join('%s\x00%s\x00%s\x00%s' % a for a in articles))
print('tokens', len(tokens), '| scoped', sum(len(x) for x in scoped),
      '| articles', [len(a[3]) for a in articles])
