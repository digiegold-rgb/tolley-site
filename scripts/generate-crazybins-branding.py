#!/usr/bin/env python3
"""Generate Crazy Bin Store #2 branding assets:
- icon.png (512x512) — favicon
- apple-icon.png (180x180) — iMessage / iOS home-screen icon
- opengraph-image.png (1200x630) — link preview image for SMS/iMessage/social

All saved into app/crazybins/ so Next.js auto-wires them via file conventions.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import os, glob

OUT = Path("app/crazybins")
OUT.mkdir(parents=True, exist_ok=True)

# Brand palette
ORANGE = (255, 107, 26)
ORANGE_DEEP = (232, 84, 10)
RED = (230, 57, 70)
YELLOW = (255, 214, 10)
NAVY = (29, 45, 80)
WHITE = (255, 255, 255)
CREAM = (255, 247, 236)


def find_font(weight="bold"):
    """Try to find a bold sans-serif font on the system."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    # Fallback: search /usr/share/fonts for any bold font
    matches = glob.glob("/usr/share/fonts/**/*Bold*.ttf", recursive=True)
    return matches[0] if matches else None


FONT = find_font()
print(f"Using font: {FONT}")


def fire_gradient(width, height, angle=135):
    """Yellow → Orange → Red diagonal gradient."""
    img = Image.new("RGB", (width, height), ORANGE)
    px = img.load()
    for y in range(height):
        for x in range(width):
            # Diagonal mix factor 0..1 from top-left to bottom-right
            t = (x + y) / (width + height)
            if t < 0.5:
                # Yellow → Orange
                lt = t * 2
                r = int(YELLOW[0] * (1 - lt) + ORANGE[0] * lt)
                g = int(YELLOW[1] * (1 - lt) + ORANGE[1] * lt)
                b = int(YELLOW[2] * (1 - lt) + ORANGE[2] * lt)
            else:
                # Orange → Red
                lt = (t - 0.5) * 2
                r = int(ORANGE[0] * (1 - lt) + RED[0] * lt)
                g = int(ORANGE[1] * (1 - lt) + RED[1] * lt)
                b = int(ORANGE[2] * (1 - lt) + RED[2] * lt)
            px[x, y] = (r, g, b)
    return img


def make_icon(size, out_path):
    """Square icon: fire gradient + bold 'CB' + small fire emoji-style accent."""
    img = fire_gradient(size, size)
    draw = ImageDraw.Draw(img)

    # Outer ring
    ring_w = max(2, size // 60)
    draw.ellipse([ring_w, ring_w, size - ring_w, size - ring_w], outline=WHITE, width=ring_w * 2)

    # 'CB' centered
    if FONT:
        text = "CB"
        font_size = int(size * 0.55)
        font = ImageFont.truetype(FONT, font_size)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (size - tw) // 2 - bbox[0]
        y = (size - th) // 2 - bbox[1] - int(size * 0.03)
        # Drop shadow for legibility
        shadow_off = max(2, size // 80)
        draw.text((x + shadow_off, y + shadow_off), text, font=font, fill=(120, 30, 30))
        draw.text((x, y), text, font=font, fill=WHITE)

        # Tiny tagline at bottom
        small_size = int(size * 0.10)
        small_font = ImageFont.truetype(FONT, small_size)
        tag = "BIN STORE"
        bbox2 = draw.textbbox((0, 0), tag, font=small_font)
        tw2 = bbox2[2] - bbox2[0]
        draw.text(((size - tw2) // 2 - bbox2[0], int(size * 0.78)), tag, font=small_font, fill=WHITE)

    img.save(out_path, "PNG", optimize=True)
    print(f"✓ {out_path} ({size}x{size})")


def make_og_image(out_path):
    """1200x630 hero card for SMS/iMessage rich preview."""
    W, H = 1200, 630
    img = fire_gradient(W, H)

    # Add subtle radial darkening at corners for depth
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for r in range(120, 0, -10):
        a = int(60 * (120 - r) / 120)
        od.ellipse([-r * 6, H - r * 4, r * 6, H + r * 4], fill=(0, 0, 0, a))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=40))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    if FONT:
        # Eyebrow
        eb_font = ImageFont.truetype(FONT, 28)
        draw.text((80, 90), "CRAZY BIN STORE #2", font=eb_font, fill=(255, 255, 255, 230))

        # Big headline
        head_font = ImageFont.truetype(FONT, 110)
        draw.text((80, 130), "Crazy Deals,", font=head_font, fill=WHITE)
        draw.text((80, 250), "Every Day.", font=head_font, fill=WHITE)

        # Sub
        sub_font = ImageFont.truetype(FONT, 32)
        draw.text((80, 400), "60–80% OFF retail · Liquidation bin store", font=sub_font, fill=(255, 255, 255, 240))

        # Address pill (use a drawn marker instead of emoji — DejaVu doesn't render 📍)
        addr_font = ImageFont.truetype(FONT, 26)
        addr = "4452 S Noland Rd, Independence, MO  ·  Open 10AM–6:30PM"
        bbox = draw.textbbox((0, 0), addr, font=addr_font)
        pad_x, pad_y = 28, 16
        marker_gap = 36
        pill_w = bbox[2] - bbox[0] + pad_x * 2 + marker_gap
        pill_h = bbox[3] - bbox[1] + pad_y * 2
        pill_x, pill_y = 80, 500
        draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
                               radius=pill_h // 2, fill=NAVY)
        # Drawn pin: a yellow drop shape
        cx, cy = pill_x + pad_x + 8, pill_y + pill_h // 2
        draw.ellipse([cx - 11, cy - 14, cx + 11, cy + 8], fill=YELLOW)
        draw.polygon([(cx - 8, cy + 4), (cx + 8, cy + 4), (cx, cy + 16)], fill=YELLOW)
        draw.ellipse([cx - 4, cy - 7, cx + 4, cy + 1], fill=NAVY)
        # Address text
        draw.text((pill_x + pad_x + marker_gap - bbox[0], pill_y + pad_y - bbox[1]), addr, font=addr_font, fill=WHITE)

        # Price chip on right (today's deal vibe)
        chip_size = 280
        chip_x, chip_y = W - chip_size - 80, 110
        draw.rounded_rectangle(
            [chip_x, chip_y, chip_x + chip_size, chip_y + chip_size],
            radius=40, fill=WHITE,
            outline=NAVY, width=6,
        )
        # "DEAL OF" / "TODAY" labels
        sm_font = ImageFont.truetype(FONT, 22)
        draw.text((chip_x + 28, chip_y + 30), "TODAY'S", font=sm_font, fill=RED)
        draw.text((chip_x + 28, chip_y + 58), "DEAL", font=sm_font, fill=RED)
        # Big price
        big_font = ImageFont.truetype(FONT, 130)
        draw.text((chip_x + 28, chip_y + 100), "$$$", font=big_font, fill=ORANGE)
        draw.text((chip_x + 28, chip_y + 230), "Different daily", font=sm_font, fill=NAVY)

    img.save(out_path, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"✓ {out_path} ({W}x{H})")


# Emit all assets
make_icon(512, OUT / "icon.png")
make_icon(180, OUT / "apple-icon.png")
make_og_image(OUT / "opengraph-image.jpg")

# Also a Twitter image (same content, different filename for Next.js convention)
import shutil
shutil.copy(OUT / "opengraph-image.jpg", OUT / "twitter-image.jpg")
print(f"✓ {OUT / 'twitter-image.jpg'} (copy of OG image)")

print("\nDone. Next.js will auto-wire these via file conventions.")
