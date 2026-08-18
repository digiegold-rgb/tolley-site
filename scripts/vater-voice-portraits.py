#!/usr/bin/env python3
"""Regenerate the voice-library portraits for tolley.io/animate.

Why these are ILLUSTRATED and not photographs
---------------------------------------------
The old set were photoreal stock-style renders at 256px with wildly
inconsistent framing (one tight headshot, one full-body yoga wide, one that
was mostly a newsroom desk with a person cropped at the edge). Worse, a
photoreal face reads as a claim about who the speaker actually IS — and for
most of these clones we do not know. A clearly illustrated persona says
"this is the character of the voice" without implying a real person's
likeness, and it matches the /animate cinema art direction.

Casting is grounded, not guessed
--------------------------------
`register` on each entry is the MEASURED median speaking F0 of the actual
reference WAV in /home/jelly/content-autopilot/vater_voices (autocorrelation
over voiced frames). Where an existing catalog note contradicted the preset's
name — AttenboroughUK and YoungCasual are both female readers despite
male-sounding labels — the measurement agreed with the note, and the portrait
follows the measurement.

Usage (system python3, same interpreter as the autopilot units):
  /usr/bin/python3 scripts/vater-voice-portraits.py --dry-run
  /usr/bin/python3 scripts/vater-voice-portraits.py --only Monroe,Cash
  /usr/bin/python3 scripts/vater-voice-portraits.py            # all 17

Outputs: public/vater/voices/<Name>.webp (512x512, q84). Existing files are
copied to public/vater/voices/_old_<date>/ first.
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
OUT_DIR = SITE / "public" / "vater" / "voices"
AUTOPILOT = Path("/home/jelly/content-autopilot")
ENV_FILES = [
    Path.home() / ".config" / "autopilot.env",
    Path.home() / "vater-studio" / "VATER-SETTINGS.env",
]
SCRATCH = Path(
    os.environ.get(
        "VOICE_PORTRAITS_SCRATCH",
        "/tmp/claude-1000/-home-jelly/voice-portraits",
    )
)
SIZE = 512

# One art direction for the whole grid. Head-and-shoulders at a fixed crop is
# what makes 17 cards read as a set instead of a stock-photo scrapbook; the
# violet/indigo ground is the /animate cinema palette.
ART_DIRECTION = (
    "painterly character portrait illustration, head and shoulders, centred, "
    "facing the viewer, warm cinematic rim light from the upper left, clean "
    "confident brushwork, deep indigo and violet background with soft bokeh, "
    "rich colour, subtle film grain, square composition"
)

# subject = who the voice sounds like. register = measured median F0 (Hz).
VOICES: dict[str, dict] = {
    "MorganDeep": {
        "register": 112,
        "subject": "an older man with a close-cropped white beard and calm "
                   "heavy-lidded eyes, dark jacket, unhurried and authoritative",
    },
    "Monroe": {
        "register": 106,
        "subject": "a broad-shouldered man in his fifties, short salt-and-pepper "
                   "hair, steady level gaze, charcoal overcoat, quietly commanding",
    },
    "Cash": {
        "register": 102,
        "subject": "a rugged man in his forties with a dark stubbled jaw and "
                   "weathered denim collar, wry half-smile, low and easy",
    },
    "Wallace": {
        "register": 98,
        "subject": "a heavyset older man with a grey moustache and kind creased "
                   "eyes, tweed jacket, deep resonant presence",
    },
    "NewsClear": {
        "register": 128,
        "subject": "a sharply groomed man in his thirties, crisp navy suit and "
                   "tie, alert direct eye contact, broadcast-desk poise",
    },
    "Narrator": {
        "register": 142,
        "subject": "a young man with curly dark hair and an open easy grin, "
                   "casual tan jacket over a white tee, relaxed and friendly",
    },
    "Nova": {
        "register": 152,
        "subject": "a man in his late twenties with a neat fade and bright "
                   "attentive eyes, olive bomber jacket, upbeat and clear",
    },
    "AttenboroughUK": {
        "register": 163,
        "subject": "a distinguished older woman with short silver hair and "
                   "wire-rim glasses, soft wool blazer, thoughtful scholarly warmth",
    },
    "Eric": {
        "register": 164,
        "subject": "a friendly man in his thirties with light stubble and a "
                   "buttoned collar shirt, approachable neighbourly smile",
    },
    "Jessica": {
        "register": 191,
        "subject": "a woman in her thirties with shoulder-length auburn hair, "
                   "warm engaged expression, soft knit sweater",
    },
    "YoungCasual": {
        "register": 192,
        "subject": "a young woman with long chestnut hair tucked behind one ear, "
                   "light cardigan, relaxed cafe-conversation smile",
    },
    "CalmFemale": {
        "register": 194,
        "subject": "a serene woman with dark hair loosely tied back, eyes softly "
                   "lowered, pale linen top, meditative stillness",
    },
    "Sterling": {
        "register": 211,
        "subject": "a poised woman in her forties with a sleek dark bob and "
                   "tailored blazer, composed confident expression",
    },
    "Junie": {
        "register": 233,
        "subject": "a cheerful young woman with wavy blonde hair and freckles, "
                   "denim jacket, animated storytelling energy",
    },
    "Beckett": {
        "register": 270,
        "subject": "a bright-eyed young woman with a short dark pixie cut, "
                   "mustard turtleneck, quick expressive intelligence",
    },
    "Rae": {
        "register": 289,
        "subject": "a lively young woman with curly red hair and a wide smile, "
                   "coral top, warm and enthusiastic",
    },
    "Birdie": {
        "register": 343,
        "subject": "a very youthful woman with a high ponytail and round "
                   "cheeks, pastel hoodie, sunny playful sparkle",
    },
}


SEED_OVERRIDE = {"Monroe": 5514}


def load_env_files() -> None:
    for f in ENV_FILES:
        if not f.is_file():
            continue
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def load_vater_module():
    """Load vater.py WITHOUT its import-time `_load_jobs()`.

    A plain import auto-resumes every pending job from vater_jobs.json inside
    THIS process, duplicating the live worker's renders (real Modal spend).
    """
    import types

    src_path = AUTOPILOT / "vater.py"
    src = src_path.read_text()
    patched, n = re.subn(
        r"^_load_jobs\(\)\s*$",
        "pass  # (disabled by vater-voice-portraits)",
        src,
        flags=re.M,
    )
    if n != 1:
        raise SystemExit(
            f"expected exactly one module-level _load_jobs() in vater.py, found {n} — refusing to import"
        )
    sys.path.insert(0, str(AUTOPILOT))
    mod = types.ModuleType("vater")
    mod.__file__ = str(src_path)
    sys.modules["vater"] = mod
    exec(compile(patched, str(src_path), "exec"), mod.__dict__)
    return mod


def build_prompt(entry: dict) -> str:
    """Art direction first, casting in the middle, art direction restated.

    Same sandwich as the style samples: models weight head and tail hardest,
    so bracketing the subject is what keeps 17 portraits in one visual family.
    """
    return (
        f"{ART_DIRECTION}. "
        f"The subject is {entry['subject']}. "
        f"Rendered as a {ART_DIRECTION}."
    )


def to_webp(src_png: Path, dst: Path) -> tuple[int, int]:
    from PIL import Image

    im = Image.open(src_png).convert("RGB")
    w, h = im.size
    side = min(w, h)  # centre-crop to square before the downscale
    im = im.crop(((w - side) // 2, (h - side) // 2, (w - side) // 2 + side, (h - side) // 2 + side))
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=84, method=6)
    return im.size


def backup_existing() -> None:
    bdir = OUT_DIR / f"_old_{date.today().isoformat()}"
    bdir.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(OUT_DIR.glob("*.webp")):
        tgt = bdir / f.name
        if not tgt.exists():
            shutil.copy2(f, tgt)
            n += 1
    print(f"[backup] {n} file(s) copied → {bdir}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", action="append", default=[])
    ap.add_argument("--quality", default="gemini-1k")
    ap.add_argument("--fallback", default="", help="quality to retry with ('' disables)")
    ap.add_argument("--seed", type=int, default=6120)
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    ap.add_argument("--budget", type=float, default=2.0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-backup", action="store_true")
    args = ap.parse_args()

    if args.quality.startswith(("firered-local", "sdxl")):
        raise SystemExit("refusing local-GPU quality for Vater work — use gemini-1k / firered-modal")

    out_dir = Path(args.out_dir)
    only = {s for chunk in args.only for s in chunk.split(",") if s.strip()}
    if only:
        bad = only - set(VOICES)
        if bad:
            raise SystemExit(f"unknown voice(s): {sorted(bad)}")

    # Deterministic per-voice seed: same name always casts the same face, so a
    # single re-run never reshuffles the whole grid. SEED_OVERRIDE pins the
    # ones whose default seed came back wrong (Monroe rendered as a framed
    # painting on a wall rather than a portrait).
    plan = [
        {"name": n, "seed": SEED_OVERRIDE.get(n, args.seed + i), "prompt": build_prompt(e)}
        for i, (n, e) in enumerate(sorted(VOICES.items()))
        if not only or n in only
    ]

    if args.dry_run:
        for p in plan:
            print(f"--- {p['name']} (seed {p['seed']})\n{p['prompt']}\n")
        print(f"[dry-run] {len(plan)} voice(s); quality={args.quality}")
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
        name = p["name"]
        raw = SCRATCH / f"{name}.png"
        t0 = time.time()
        try:
            _, used = V._run_image_scene_router(
                p["prompt"], raw, quality=args.quality, seed=p["seed"], aspect="1:1",
            )
        except Exception as e:  # noqa: BLE001
            print(f"[{name}] {args.quality} FAILED — {type(e).__name__}: {str(e)[:200]}")
            if not args.fallback:
                raise
            t0 = time.time()
            _, used = V._run_image_scene_router(
                p["prompt"], raw, quality=args.fallback, seed=p["seed"], aspect="1:1",
            )
        secs = time.time() - t0
        cost = est_cost(used, secs)
        total += cost
        size = to_webp(raw, out_dir / f"{name}.webp")
        log.append({"name": name, "quality": used, "seed": p["seed"],
                    "secs": round(secs, 1), "usd": round(cost, 4), "size": size})
        print(f"[{name}] {used} {secs:.0f}s ${cost:.3f} → {name}.webp {size[0]}x{size[1]}  (running ${total:.2f})")
        (SCRATCH / "voice-portraits-log.json").write_text(json.dumps(log, indent=2))

        remaining = len(plan) - idx - 1
        if total + remaining * (total / (idx + 1)) > args.budget:
            print(f"[budget] projected over cap ${args.budget:.2f} — stopping after {idx + 1}/{len(plan)}")
            return 2

    print(f"\n[done] {len(log)} portrait(s), total est ${total:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
