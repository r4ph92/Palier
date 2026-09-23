# -*- coding: utf-8 -*-
"""Generateur de diagrammes de sequence UML en SVG, coordonnees calculees."""
from html import escape

PITCH = 196
BOXW = 172
MARGIN = 44
HEAD_Y = 26
HEAD_H = 52
FIRST_Y = 124
STEP = 46
SELF_H = 30


def esc(s):
    return escape(s, quote=True)


def build(participants, messages, fragments=(), title=""):
    """participants: [(nom, sous-titre, kind)]  kind in ext|app|api|db|svc
    messages: [(src, dst, texte, kind)] kind in msg|ret|self|found
    fragments: [(label, first_idx, last_idx, [(idx, sep_label)])]
    """
    n = len(participants)
    def cx(i):
        return MARGIN + BOXW // 2 + i * PITCH

    # --- assign y to every message
    ys = []
    y = FIRST_Y
    frag_starts = {f[1]: f for f in fragments}
    frag_ends = {f[2]: f for f in fragments}
    seps = {}
    for f in fragments:
        for idx, lab in f[3]:
            seps[idx] = lab

    for i, m in enumerate(messages):
        if i in frag_starts:
            y += 50
        if i in seps:
            y += 42
        ys.append(y)
        y += SELF_H + STEP if m[3] == "self" else STEP
        if i in frag_ends:
            y += 18

    height = y + 34
    width = MARGIN * 2 + (n - 1) * PITCH + BOXW
    out = []
    a = out.append

    a('<svg viewBox="0 0 %d %d" role="img" aria-label="%s">' % (width, height, esc(title)))

    # lifelines
    for i in range(n):
        a('<line class="ll" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (cx(i), HEAD_Y + HEAD_H, cx(i), height - 18))

    # fragments
    for frag in fragments:
        label, i0, i1, sp = frag[0], frag[1], frag[2], frag[3]
        guard = frag[4] if len(frag) > 4 else None
        top = ys[i0] - 46
        bot = ys[i1] + (SELF_H if messages[i1][3] == "self" else 0) + 26
        a('<rect class="frm" x="%d" y="%d" width="%d" height="%d"/>' % (MARGIN - 16, top, width - 2 * (MARGIN - 16), bot - top))
        a('<path class="frm-tab" d="M%d,%d h58 l14,14 v10 h-72 z"/>' % (MARGIN - 16, top))
        a('<text class="t-frag" x="%d" y="%d">%s</text>' % (MARGIN - 8, top + 17, esc(label)))
        if guard:
            a('<text class="t-frag-s" x="%d" y="%d">%s</text>' % (MARGIN + 62, top + 17, esc(guard)))
        for idx, lab in sp:
            sy = ys[idx] - 36
            a('<line class="frm-sep" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (MARGIN - 16, sy, width - MARGIN + 16, sy))
            a('<text class="t-frag-s" x="%d" y="%d">%s</text>' % (MARGIN - 8, sy + 15, esc(lab)))

    # messages
    for i, (s, d, txt, kind) in enumerate(messages):
        y = ys[i]
        if kind == "self":
            x = cx(s)
            a('<path class="msg" d="M%d,%d H%d V%d H%d" marker-end="url(#sq)"/>' % (x, y, x + 54, y + SELF_H, x + 6))
            a('<text class="t-msg" x="%d" y="%d">%s</text>' % (x + 66, y + SELF_H // 2 + 4, esc(txt)))
            continue
        if kind == "found":
            x = cx(d)
            a('<circle class="found" cx="%d" cy="%d" r="5"/>' % (x - 150, y))
            a('<path class="msg" d="M%d,%d H%d" marker-end="url(#sq)"/>' % (x - 145, y, x - 6))
            a('<text class="t-msg" x="%d" y="%d">%s</text>' % (x - 148, y - 9, esc(txt)))
            continue
        x1, x2 = cx(s), cx(d)
        cls = "ret" if kind == "ret" else "msg"
        sign = 1 if x2 > x1 else -1
        a('<path class="%s" d="M%d,%d H%d" marker-end="url(#sq)"/>' % (cls, x1 + 6 * sign, y, x2 - 6 * sign))
        mid = (x1 + x2) / 2
        a('<text class="t-msg" x="%.0f" y="%d" text-anchor="middle">%s</text>' % (mid, y - 9, esc(txt)))

    # headers on top
    for i, (name, sub, kind) in enumerate(participants):
        x = cx(i) - BOXW // 2
        a('<rect class="p p-%s" x="%d" y="%d" width="%d" height="%d" rx="3"/>' % (kind, x, HEAD_Y, BOXW, HEAD_H))
        a('<text class="t-p" x="%d" y="%d" text-anchor="middle">%s</text>' % (cx(i), HEAD_Y + 22, esc(name)))
        a('<text class="t-ps" x="%d" y="%d" text-anchor="middle">%s</text>' % (cx(i), HEAD_Y + 39, esc(sub)))

    a("</svg>")
    return "\n".join(out)
