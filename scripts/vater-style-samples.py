#!/usr/bin/env python3
"""Regenerate the 17 style preview images for tolley.io/animate.

Same subject rendered through every STYLE_PRESETS.promptPrefix from
lib/vater/style-presets.ts so the picker grid reads as one comparable set.
Renders via vater.py's image router on Modal (firered-modal, H100) — never
the local GPU (Vater doctrine) — with a cloud gemini-1k fallback.

Usage (run with system python3 — same interpreter as the autopilot units):
  /usr/bin/python3 scripts/vater-style-samples.py --dry-run
  /usr/bin/python3 scripts/vater-style-samples.py --only cinematic
  /usr/bin/python3 scripts/vater-style-samples.py            # all 17
  /usr/bin/python3 scripts/vater-style-samples.py --quality gemini-1k --only pixar,anime

Outputs: public/vater/styles/<id>.webp (768x432, q82). Existing files are
copied to public/vater/styles/_old_<date>/ before being overwritten.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
from datetime import date
from pathlib import Path

SITE = Path("/home/jelly/tolley-site")
PRESETS_TS = SITE / "lib" / "vater" / "style-presets.ts"
OUT_DIR = SITE / "public" / "vater" / "styles"
AUTOPILOT = Path("/home/jelly/content-autopilot")
ENV_FILES = [
    Path.home() / ".config" / "autopilot.env",
    Path.home() / "vater-studio" / "VATER-SETTINGS.env",
]
SCRATCH = Path(
    os.environ.get(
        "STYLE_SAMPLES_SCRATCH",
        "/tmp/claude-1000/-home-jelly/4d490c20-14a3-44b3-8a7d-254e7d9f5975/scratchpad/style-samples",
    )
)

# Positive phrasing only — negations ("no text") summon the thing they name.
#
# 2026-08-17 rewrite. The old subject was three lines long and ended in
# "golden hour", so it out-weighed every style prefix and pinned one warm
# cream palette on all 17 renders — "Cinematic" came back as the same cartoon
# as "Pixel Art". The subject is now SHORT and carries no lighting or palette
# language, leaving those to the style. See build_prompt() for the sandwich.
SUBJECT = (
    "a woman in a red scarf sitting on a park bench beside a small orange "
    "fox, one large tree behind them, wide shot"
)
DEFAULT_SEED = 4242
# Per-style overrides. Two reasons a style gets one: identical-prompt presets
# need to diverge, or the default seed produced a render that did not read as
# the medium. These are the exact seeds behind the images currently shipped.
SEED_OVERRIDE = {
    "animated_explainer": 7781,
    "comic_book": 7781,
    "pixar": 7781,
    "pixel_art": 3311,
}
# Per-style reinforcement for the presets whose medium the model under-reads.
# Each line names the physical TELL of that medium — the thing a viewer uses to
# identify it at thumbnail size — because the bare preset prefix alone came
# back as a generic painted illustration for these four.
SUBJECT_SUFFIX = {
    "animated_explainer": (
        ", flat vector motion-graphics, simple filled shapes, full-bleed frame "
        "filling the whole canvas edge to edge"
    ),
    "pixar": (
        ", 3D CGI render, subsurface-scattering skin, rounded stylised "
        "proportions, glossy specular highlights, ray-traced soft shadows, a "
        "frame from a Pixar feature film"
    ),
    "pixel_art": (
        ", a low-resolution 16-bit SNES game screenshot, roughly 160 pixels "
        "wide upscaled with hard nearest-neighbour edges, every shape made of "
        "big blocky squares, aliased stair-stepped diagonals, 32-colour "
        "indexed palette, dithered shading"
    ),
    "comic_book": (
        ", inked comic panel with heavy black linework, visible halftone Ben-Day "
        "dot shading, flat spot colour, a bold panel border"
    ),
}
EXPECTED_IDS = [
    "cinematic", "comic_book", "anime", "pixel_art", "pixar", "digital_art",
    "watercolor", "low_poly", "whiteboard_cartoon", "animated_explainer",
    "flat_cartoon", "classic_cartoon", "chibi_kawaii", "shonen_action",
    "slice_of_life", "flat_modern", "storybook",
]
W, H = 768, 432


def load_env_files() -> None:
    """KEY=VAL lines from the autopilot env files; never override live env."""
    for f in ENV_FILES:
        if not f.is_file():
            continue
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def load_vater_module():
    """Load vater.py WITHOUT its import-time side effects.

    A plain `import vater` runs `_load_jobs()` at module bottom, which
    auto-resumes every pending/running job from vater_jobs.json inside THIS
    process — duplicating the live API worker's renders (real Modal spend)
    and clobbering vater_jobs.json. We exec the source with that one call
    removed so only the helper functions/constants are available.
    """
    import types

    src_path = AUTOPILOT / "vater.py"
    src = src_path.read_text()
    patched, n = re.subn(r"^_load_jobs\(\)\s*$", "pass  # (disabled by vater-style-samples)", src, flags=re.M)
    if n != 1:
        raise SystemExit(f"expected exactly one module-level _load_jobs() call in vater.py, found {n} — refusing to import")
    sys.path.insert(0, str(AUTOPILOT))
    mod = types.ModuleType("vater")
    mod.__file__ = str(src_path)
    sys.modules["vater"] = mod
    exec(compile(patched, str(src_path), "exec"), mod.__dict__)
    return mod


def parse_presets() -> list[tuple[str, str]]:
    src = PRESETS_TS.read_text()
    body = src.split("STYLE_PRESETS", 1)[1]
    pairs = re.findall(
        r'\bid:\s*"([^"]+)".*?\bpromptPrefix:\s*"((?:[^"\\]|\\.)*)"',
        body,
        re.S,
    )
    out = [(i, p.encode().decode("unicode_escape")) for i, p in pairs]
    ids = [i for i, _ in out]
    missing = [i for i in EXPECTED_IDS if i not in ids]
    if missing:
        raise SystemExit(f"presets missing from ts: {missing}")
    return out


def build_prompt(style_id: str, prefix: str) -> str:
    """Style sandwich: medium first, subject in the middle, medium restated.

    Diffusion and Gemini image models both weight the head and tail of a
    prompt most heavily. Naming the medium at BOTH ends — and describing the
    subject only in between — is what stops a long subject clause from
    flattening every style into the same illustration.
    """
    suffix = SUBJECT_SUFFIX.get(style_id, "")
    return (
        f"{prefix}. "
        f"Subject: {SUBJECT}{suffix}. "
        f"The entire image is rendered as {prefix} — the medium is unmistakable "
        f"at a glance."
    )


def to_webp(src_png: Path, dst: Path) -> tuple[int, int]:
    from PIL import Image

    im = Image.open(src_png).convert("RGB")
    w, h = im.size
    target = W / H
    if w / h > target:  # too wide → crop sides
        nw = int(round(h * target))
        x0 = (w - nw) // 2
        im = im.crop((x0, 0, x0 + nw, h))
    elif w / h < target:  # too tall → crop top/bottom
        nh = int(round(w / target))
        y0 = (h - nh) // 2
        im = im.crop((0, y0, w, y0 + nh))
    im = im.resize((W, H), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=82, method=6)
    return im.size


def backup_existing() -> Path:
    bdir = OUT_DIR / f"_old_{date.today().isoformat()}"
    bdir.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(OUT_DIR.glob("*.webp")):
        tgt = bdir / f.name
        if not tgt.exists():
            shutil.copy2(f, tgt)
            n += 1
    print(f"[backup] {n} file(s) copied → {bdir}")
    return bdir


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", action="append", default=[], help="style id(s), comma-separable, repeatable")
    ap.add_argument("--quality", default="firered-modal", help="firered-modal | firered-modal-fast | gemini-1k | gemini-2k | ideogram-*")
    ap.add_argument("--fallback", default="gemini-1k", help="quality to retry with if primary raises ('' to disable)")
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--budget", type=float, default=5.0, help="USD cap; abort when projected total exceeds it")
    ap.add_argument("--out-dir", default=str(OUT_DIR), help="where to write .webp (A/B runs point this at scratch)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-backup", action="store_true")
    args = ap.parse_args()

    if args.quality.startswith(("firered-local", "sdxl")):
        raise SystemExit("refusing local-GPU quality for Vater work — use firered-modal / gemini-1k")

    out_dir = Path(args.out_dir)
    presets = parse_presets()
    only = {s for chunk in args.only for s in chunk.split(",") if s.strip()}
    if only:
        bad = only - {i for i, _ in presets}
        if bad:
            raise SystemExit(f"unknown style id(s): {sorted(bad)}")
        presets = [(i, p) for i, p in presets if i in only]

    plan = []
    for sid, prefix in presets:
        plan.append({"id": sid, "seed": SEED_OVERRIDE.get(sid, args.seed), "prompt": build_prompt(sid, prefix)})

    if args.dry_run:
        for p in plan:
            print(f"--- {p['id']} (seed {p['seed']})\n{p['prompt']}\n")
        print(f"[dry-run] {len(plan)} style(s); quality={args.quality} fallback={args.fallback or 'none'}")
        return 0

    load_env_files()
    V = load_vater_module()

    if not args.no_backup and out_dir == OUT_DIR:
        backup_existing()

    SCRATCH.mkdir(parents=True, exist_ok=True)
    log: list[dict] = []
    total = 0.0

    def est_cost(used: str, secs: float) -> float:
        if used in ("firered-modal", "firered-modal-fast"):
            return secs * V._MODAL_GPU_RATE_H100
        if used.startswith("gemini"):
            return V._EST_GEMINI_IMAGE_USD.get(used, 0.04)
        if used.startswith("ideogram"):
            return V._EST_IDEOGRAM_IMAGE_USD
        return 0.0

    for idx, p in enumerate(plan):
        sid = p["id"]
        raw = SCRATCH / f"{sid}.png"
        used = args.quality
        t0 = time.time()
        err = None
        try:
            _, used = V._run_image_scene_router(
                p["prompt"], raw, quality=args.quality, seed=p["seed"], aspect="16:9",
            )
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {str(e)[:200]}"
            print(f"[{sid}] {args.quality} FAILED — {err}")
            if not args.fallback:
                raise
            print(f"[{sid}] retrying with {args.fallback}")
            t0 = time.time()
            _, used = V._run_image_scene_router(
                p["prompt"], raw, quality=args.fallback, seed=p["seed"], aspect="16:9",
            )
        secs = time.time() - t0
        cost = est_cost(used, secs)
        total += cost
        size = to_webp(raw, out_dir / f"{sid}.webp")
        entry = {"id": sid, "quality": used, "seed": p["seed"], "secs": round(secs, 1),
                 "usd": round(cost, 4), "size": size, "primary_error": err}
        log.append(entry)
        print(f"[{sid}] {used} {secs:.0f}s ${cost:.3f} → {sid}.webp {size[0]}x{size[1]}  (running ${total:.2f})")
        (SCRATCH / "style-samples-log.json").write_text(json.dumps(log, indent=2))

        remaining = len(plan) - idx - 1
        projected = total + remaining * (total / (idx + 1))
        if projected > args.budget:
            print(f"[budget] projected ${projected:.2f} > cap ${args.budget:.2f} — stopping after {idx + 1}/{len(plan)}")
            return 2

    print(f"\n[done] {len(log)} image(s), total est ${total:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
