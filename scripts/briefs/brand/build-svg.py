#!/usr/bin/env python3
"""Builds the distributable Jelly Studio logo SVGs with the type converted to
outlines — no font dependency at all in the shipped file.

Glyph paths come from the real fonts (Space Grotesk 700, instanced out of the
variable font; IBM Plex Mono 400). Positions come from layout.json, which
measure-layout.mjs read straight out of chromium's layout of the handoff's own
CSS — so the vector lands exactly where the reference raster puts it, kerning
and tracking included, instead of being re-derived from line-box guesswork.

    python3 build-svg.py <layout.json> <fontdir> <outdir>
"""
import json
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

CANVAS = 340.0
RADIUS_PCT = 28.0 / 340.0          # 8.235% of the edge, per the handoff
PINK = "#ef6dc9"                    # oklch(0.72 0.19 340) as chromium renders it
INK = "#17131a"
REVERSED_BG = "#131318"
REVERSED_INK = "#f7f5fa"


def load_fonts(fontdir: Path):
    sg = TTFont(fontdir / "SpaceGrotesk-var.ttf")
    sg = instancer.instantiateVariableFont(sg, {"wght": 700})
    plex = TTFont(fontdir / "IBMPlexMono-Regular.ttf")
    return {"Space Grotesk": sg, "IBM Plex Mono": plex}


def glyph_path(font: TTFont, char: str, size: float, x: float, baseline: float) -> str:
    """One character's outline, scaled to `size` and placed on the baseline.

    The font's y axis points up and SVG's points down, so the transform flips y
    while scaling by size/unitsPerEm.
    """
    upem = font["head"].unitsPerEm
    scale = size / upem
    glyph_name = font.getBestCmap()[ord(char)]
    pen = SVGPathPen(font.getGlyphSet())
    tpen = TransformPen(pen, (scale, 0, 0, -scale, x, baseline))
    font.getGlyphSet()[glyph_name].draw(tpen)
    return pen.getCommands()


def line_paths(fonts, line) -> str:
    font = fonts[line["font"]]
    out = []
    for i, ch in enumerate(line["text"]):
        d = glyph_path(font, ch, line["fontSize"], line["left"] + line["advances"][i], line["baseline"])
        if d.strip():
            out.append(d)
    return " ".join(out)


def build(lines, ids, ink, bg, radius=True, sub_opacity=0.72):
    """Compose one SVG. `bg` of None leaves the plate transparent (mono stamps)."""
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS:.0f} {CANVAS:.0f}" '
        f'width="{CANVAS:.0f}" height="{CANVAS:.0f}" role="img" aria-label="Jelly Studio">',
        "<title>Jelly Studio</title>",
    ]
    if bg:
        r = CANVAS * RADIUS_PCT
        parts.append(
            f'<rect width="{CANVAS:.0f}" height="{CANVAS:.0f}" rx="{r:.3f}" ry="{r:.3f}" fill="{bg}"/>'
        )
    for lid in ids:
        line = lines[lid]
        d = line_paths(FONTS, line)
        op = "" if line["opacity"] >= 0.999 else f' opacity="{sub_opacity}"'
        parts.append(f'<path{op} d="{d}" fill="{ink}"/>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


if __name__ == "__main__":
    layout_path, fontdir, outdir = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    data = json.load(open(layout_path))
    lines = {l["id"]: l for l in data["lines"]}
    FONTS = load_fonts(fontdir)

    full = ["jelly", "studio", "tolley"]
    compact = ["c-jelly", "c-studio"]

    outdir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, ids, ink, bg in [
        ("logo.svg", full, INK, PINK),
        ("logo-compact.svg", compact, INK, PINK),
        ("logo-reversed.svg", full, REVERSED_INK, REVERSED_BG),
        ("logo-mono-black.svg", full, "#000000", None),
        ("logo-mono-white.svg", full, "#ffffff", None),
    ]:
        svg = build(lines, ids, ink, bg)
        (outdir / name).write_text(svg)
        written.append((name, len(svg)))

    for name, size in written:
        print(f"{name:26s} {size/1024:6.1f} KB")
