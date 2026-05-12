#!/usr/bin/env python3
"""
Genera public/icon.svg: WN como paths (Helvetica Neue Bold del .ttc de macOS),
círculo #FF9500, fondo #0a0a0a, esquinas rx=80, geometría según especificación.

Requiere: pip install fonttools
Fuente: ICON_FONT_PATH (.ttf/.otf/.ttc) o en macOS /System/Library/Fonts/HelveticaNeue.ttc
Índice de subfuente en TTC: ICON_TTC_INDEX (opcional; por defecto se elige Bold).
"""

from __future__ import annotations

import os
import sys

CANVAS = 512
CIRCLE_R = 18
CORNER_RX = 80
FONT_SIZE = 268


def rq(x: float, n: int = 3) -> float:
    return round(x, n)


def pick_font_from_ttc(col) -> object:
    idx_env = os.environ.get("ICON_TTC_INDEX")
    if idx_env is not None:
        return col.fonts[int(idx_env)]
    for i, f in enumerate(col.fonts):
        name = f.get("name")
        if not name:
            continue
        sub = name.getName(2, 3, 1, 1033) or name.getName(2, 3, 1, 0x409)
        sub = sub.toUnicode() if sub else ""
        if sub == "Bold" and "Italic" not in sub and "Condensed" not in sub:
            return f
    return col.fonts[1]


def main() -> None:
    try:
        from fontTools.ttLib import TTFont
        from fontTools.ttLib.ttCollection import TTCollection
        from fontTools.pens.boundsPen import BoundsPen
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
    except ImportError:
        print("fonttools no instalado; omitiendo build-wn-icon-svg (usa: pip install fonttools)", file=sys.stderr)
        sys.exit(0)

    font_path = os.environ.get("ICON_FONT_PATH")
    if not font_path:
        if sys.platform == "darwin":
            font_path = "/System/Library/Fonts/HelveticaNeue.ttc"
        else:
            print("Define ICON_FONT_PATH a un .ttf/.otf/.ttc con Helvetica Neue o similar.", file=sys.stderr)
            sys.exit(0)

    if not os.path.isfile(font_path):
        print(f"No se encuentra la fuente: {font_path}", file=sys.stderr)
        sys.exit(0)

    if font_path.lower().endswith(".ttc"):
        col = TTCollection(font_path)
        font = pick_font_from_ttc(col)
    else:
        font = TTFont(font_path)

    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"].metrics
    upem = font["head"].unitsPerEm
    s = FONT_SIZE / upem

    gw = cmap[ord("W")]
    gn = cmap[ord("N")]
    adv_w = hmtx[gw][0]

    pen_w = SVGPathPen(glyph_set)
    glyph_set[gw].draw(TransformPen(pen_w, (s, 0, 0, s, 0, 0)))
    d_w = pen_w.getCommands()

    pen_n = SVGPathPen(glyph_set)
    glyph_set[gn].draw(TransformPen(pen_n, (s, 0, 0, s, adv_w * s, 0)))
    d_n = pen_n.getCommands()

    bp = BoundsPen(glyph_set)
    glyph_set[gw].draw(TransformPen(bp, (s, 0, 0, s, 0, 0)))
    minx_w, miny_w, maxx_w, maxy_w = bp.bounds
    bp2 = BoundsPen(glyph_set)
    glyph_set[gn].draw(TransformPen(bp2, (s, 0, 0, s, adv_w * s, 0)))
    minx_n, miny_n, maxx_n, maxy_n = bp2.bounds
    minx = min(minx_w, minx_n)
    maxx = max(maxx_w, maxx_n)
    miny = min(miny_w, miny_n)
    maxy = max(maxy_w, maxy_n)

    gw_px = maxx - minx
    M = (CANVAS - gw_px - 2 * CIRCLE_R) / 2
    ty = CANVAS / 2 + (miny + maxy) / 2
    tx = M - minx
    cx = 2 * M + gw_px + CIRCLE_R
    cy = ty

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_svg = os.path.join(root, "public", "icon.svg")

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="{CORNER_RX}" ry="{CORNER_RX}" fill="#0a0a0a" />
  <g fill="#ffffff" transform="translate({rq(tx)},{rq(ty)}) scale(1,-1)">
    <path d="{d_w}" />
    <path d="{d_n}" />
  </g>
  <circle cx="{rq(cx)}" cy="{rq(cy)}" r="{CIRCLE_R}" fill="#FF9500" />
</svg>
"""

    with open(out_svg, "w", encoding="utf-8") as f:
        f.write(svg)
    print("Wrote", out_svg)


if __name__ == "__main__":
    main()
