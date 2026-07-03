#!/usr/bin/env python3
"""
Extract the real photos baked into the 13:13 Weddings & Events brochure.

Pipeline per HEIC:
  1. Decode HEIC → numpy BGR (full-res 4284×5712).
  2. Auto-detect the white brochure paper against the textured blanket
     using adaptive threshold + largest-contour approximation.
  3. Perspective-correct the paper to canonical orientation.
  4. Apply hand-tuned proportional crop boxes (normalized 0..1) to pull
     out each embedded photo.
  5. Emit WebP triplets and regenerate components/wedding/data/photos.ts.

Idempotent. Run again after tuning proportional boxes.
"""
from __future__ import annotations

import base64
import io
import json
import shutil
from pathlib import Path
from typing import TypedDict

import cv2
import numpy as np
import pillow_heif
pillow_heif.register_heif_opener()
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SRC = Path("/home/jelly/Shared/wedding")
OUT = REPO / "public" / "e-and-t" / "photos" / "extracted"
LEGACY = REPO / "public" / "e-and-t" / "photos"
REFERENCE_DIR = LEGACY / "_reference"
DEBUG_DIR = REPO / ".extract-debug"
MANIFEST_TS = REPO / "components" / "wedding" / "data" / "photos.ts"


class Crop(TypedDict):
    id: str
    source: str            # IMG_2884..2887
    box: tuple             # (x0, y0, x1, y1) — normalized 0..1 within rectified paper
    alt: str
    span: int


# After perspective rectification, the brochure appears axis-aligned. The cover
# (2884) is a single panel. The other three are 2-page spreads — left panel
# occupies x ≈ 0..0.5, right panel x ≈ 0.5..1.0.
CROPS: list[Crop] = [
    {
        "id": "cover-florals",
        "source": "IMG_2884",
        "box": (0.215, 0.155, 0.785, 0.880),
        "alt": "Floral altar arrangement — 13:13 Weddings & Events",
        "span": 2,
    },
    {
        "id": "champagne-toast",
        "source": "IMG_2885",
        "box": (0.075, 0.075, 0.455, 0.330),
        "alt": "Champagne toast — couple's hands clinking glasses",
        "span": 1,
    },
    {
        "id": "beach-arch-day",
        "source": "IMG_2885",
        "box": (0.540, 0.110, 0.975, 0.355),
        "alt": "Cross-and-floral altar at the beach during golden hour",
        "span": 1,
    },
    {
        "id": "group-celebration",
        "source": "IMG_2886",
        "box": (0.540, 0.565, 0.975, 0.900),
        "alt": "Group toast around the newlyweds at the reception",
        "span": 1,
    },
    {
        "id": "beach-arch-sunset",
        "source": "IMG_2887",
        "box": (0.075, 0.085, 0.450, 0.335),
        "alt": "Cross-and-floral altar at sunset on the beach",
        "span": 2,
    },
    {
        "id": "emily-trevor-portrait",
        "source": "IMG_2887",
        "box": (0.540, 0.555, 0.985, 0.840),
        "alt": "Emily and Trevor Hawk at the sweetheart table — \"found the one whom my soul loves\"",
        "span": 1,
    },
]


def load_heic(path: Path) -> np.ndarray:
    """HEIC → numpy BGR (full resolution)."""
    img = Image.open(path)
    # Honor EXIF orientation
    img = Image.fromarray(np.array(img))
    arr = np.array(img.convert("RGB"))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def order_points(pts: np.ndarray) -> np.ndarray:
    """Sort 4 points as TL, TR, BR, BL by sum/diff heuristic."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]   # TL
    rect[2] = pts[np.argmax(s)]   # BR
    rect[1] = pts[np.argmin(d)]   # TR
    rect[3] = pts[np.argmax(d)]   # BL
    return rect


def find_paper_quad(bgr: np.ndarray) -> np.ndarray | None:
    """Find the 4 corners of the brochure paper.

    Strategy: downsample → grayscale → blur → adaptive threshold → morphology
    → find biggest contour → polygon approximation. Returns 4 points in
    full-resolution coords as a (4,2) float32 array (TL, TR, BR, BL), or None.
    """
    H, W = bgr.shape[:2]
    scale = 1000 / max(H, W)
    small = cv2.resize(bgr, (int(W * scale), int(H * scale)))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    # Adaptive threshold to isolate the bright paper vs textured blanket.
    th = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 35, -10,
    )
    # Closing to merge interior holes (text / dark photos)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
    closed = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    for c in contours[:3]:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            quad = approx.reshape(4, 2).astype("float32")
            return order_points(quad) / scale
    # Fallback: minAreaRect of largest contour
    rect = cv2.minAreaRect(contours[0])
    box = cv2.boxPoints(rect).astype("float32")
    return order_points(box) / scale


def rectify(bgr: np.ndarray, quad: np.ndarray, target_w: int = 3200) -> np.ndarray:
    """Warp the paper quad to an axis-aligned rectangle.

    Preserves rough aspect ratio from the quad's average edges. target_w sets the
    output rectified width.
    """
    tl, tr, br, bl = quad
    w_top = np.linalg.norm(tr - tl)
    w_bot = np.linalg.norm(br - bl)
    h_left = np.linalg.norm(bl - tl)
    h_right = np.linalg.norm(br - tr)
    aspect = ((h_left + h_right) / 2) / ((w_top + w_bot) / 2)
    target_h = int(round(target_w * aspect))
    dst = np.array(
        [[0, 0], [target_w - 1, 0], [target_w - 1, target_h - 1], [0, target_h - 1]],
        dtype="float32",
    )
    M = cv2.getPerspectiveTransform(quad, dst)
    return cv2.warpPerspective(bgr, M, (target_w, target_h))


def make_blur_data_url_from_bgr(bgr: np.ndarray) -> str:
    """Tiny 12-wide WebP base64 for next/image blurDataURL."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    pil.thumbnail((12, 12))
    buf = io.BytesIO()
    pil.save(buf, "WEBP", quality=40)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def move_legacy_to_reference() -> None:
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    moved = 0
    for p in sorted(LEGACY.glob("img_*-*.webp")):
        target = REFERENCE_DIR / p.name
        if target.exists():
            p.unlink()
        else:
            shutil.move(str(p), target)
            moved += 1
    if moved:
        print(f"  moved {moved} legacy brochure-on-blanket WebPs → _reference/")


def save_webps(bgr: np.ndarray, slug: str) -> tuple[int, int]:
    """Save 800/1600/2400 WebP triplets. Returns final (w, h) of source bgr."""
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    for target_w in (800, 1600, 2400):
        actual_w = min(target_w, w)
        ratio = actual_w / w
        target_h = int(round(h * ratio))
        resized = pil.resize((actual_w, target_h), Image.LANCZOS)
        dest = OUT / f"{slug}-{target_w}.webp"
        quality = 80 if target_w == 2400 else 86
        resized.save(dest, "WEBP", quality=quality, method=6)
    return w, h


def extract() -> list[dict]:
    OUT.mkdir(parents=True, exist_ok=True)
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)

    # Cache rectified pages keyed by source
    rectified: dict[str, np.ndarray] = {}

    manifest: list[dict] = []
    for crop in CROPS:
        src = SRC / f"{crop['source']}.HEIC"
        if not src.exists():
            print(f"  ! missing {src}")
            continue
        if crop["source"] not in rectified:
            print(f"  loading {crop['source']}.HEIC ...")
            bgr = load_heic(src)
            quad = find_paper_quad(bgr)
            if quad is None:
                print(f"  ! paper quad not found for {crop['source']}, falling back to full image")
                rect = bgr
            else:
                rect = rectify(bgr, quad, target_w=3200)
                print(f"  rectified {crop['source']} → {rect.shape[1]}×{rect.shape[0]}")
            rectified[crop["source"]] = rect
            # Save a thumbnail for debugging the quad
            debug = cv2.resize(rect, (800, int(800 * rect.shape[0] / rect.shape[1])))
            cv2.imwrite(str(DEBUG_DIR / f"rectified-{crop['source']}.jpg"), debug,
                        [cv2.IMWRITE_JPEG_QUALITY, 80])
        page = rectified[crop["source"]]
        H, W = page.shape[:2]
        x0, y0, x1, y1 = crop["box"]
        px0 = max(0, int(round(x0 * W)))
        py0 = max(0, int(round(y0 * H)))
        px1 = min(W, int(round(x1 * W)))
        py1 = min(H, int(round(y1 * H)))
        if px1 <= px0 or py1 <= py0:
            print(f"  ! degenerate box for {crop['id']}, skipping")
            continue
        sub = page[py0:py1, px0:px1]
        w, h = save_webps(sub, crop["id"])
        manifest.append({
            "id": crop["id"],
            "width": w,
            "height": h,
            "ratio": round(w / h, 4),
            "blurDataURL": make_blur_data_url_from_bgr(sub),
            "alt": crop["alt"],
            "span": crop["span"],
        })
        print(f"  ✓ {crop['id']} ({w}×{h})")

    return manifest


def write_manifest(photos: list[dict]) -> None:
    header = (
        "// AUTOGENERATED by scripts/extract-brochure-photos.py — do not edit by hand.\n"
        "// Re-run after tuning crop boxes in the script.\n\n"
        "export type WeddingPhoto = {\n"
        "  id: string;\n"
        "  width: number;\n"
        "  height: number;\n"
        "  ratio: number;\n"
        "  blurDataURL: string;\n"
        "  alt: string;\n"
        "  span?: 1 | 2;\n"
        "  src: string;\n"
        "};\n\n"
        "export const PHOTOS: WeddingPhoto[] = [\n"
    )
    rows: list[str] = []
    for p in photos:
        rows.append(
            "  {\n"
            f"    \"id\": {json.dumps(p['id'])},\n"
            f"    \"width\": {p['width']},\n"
            f"    \"height\": {p['height']},\n"
            f"    \"ratio\": {p['ratio']},\n"
            f"    \"blurDataURL\": {json.dumps(p['blurDataURL'])},\n"
            f"    \"alt\": {json.dumps(p['alt'])},\n"
            f"    \"span\": {p['span']},\n"
            f"    \"src\": \"/e-and-t/photos/extracted/{p['id']}\"\n"
            "  },"
        )
    body = "\n".join(rows) + "\n];\n"
    MANIFEST_TS.write_text(header + body)
    print(f"  wrote {MANIFEST_TS}")


if __name__ == "__main__":
    move_legacy_to_reference()
    photos = extract()
    write_manifest(photos)
    print(f"\nDone — extracted {len(photos)} photos. Debug previews: {DEBUG_DIR}")
