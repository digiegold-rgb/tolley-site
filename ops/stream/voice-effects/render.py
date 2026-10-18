"""Render an original, transparent fireworks overlay with no third-party artwork."""
import argparse
import math
from pathlib import Path
import random
import subprocess

from PIL import Image, ImageDraw, ImageFilter

FPS = 30
DURATION = 5.8
PALETTE = [(255, 185, 65), (255, 82, 156), (64, 226, 255), (195, 132, 255)]


def particles():
    rng = random.Random(830)
    bursts = [(0.90, .19, .25, 0), (1.40, .82, .39, 2), (2.00, .51, .14, 1),
              (2.65, .15, .56, 3), (3.10, .85, .69, 0), (3.55, .51, .31, 2)]
    result = []
    for start, x, y, color in bursts:
        sparks = []
        for i in range(135):
            angle = rng.random() * math.tau
            speed = rng.uniform(.04, .17) * (1 if i % 4 else .55)
            sparks.append((angle, speed, rng.uniform(1.6, 2.1), rng.random() * 9))
        result.append((start, x, y, PALETTE[color], sparks))
    return result


BURSTS = particles()


def frame(t, width=540, height=960):
    canvas = Image.new("RGBA", (width, height))
    if t < .05 or t > DURATION - .15:
        return canvas
    d = ImageDraw.Draw(canvas)
    size = min(width, height)
    for start, x, y, color, sparks in BURSTS:
        age = t - start
        if -.65 <= age < 0:
            progress = (age + .65) / .65
            rocket_y = height * (.98 + (y - .98) * (1 - (1-progress)**2))
            rocket_x = width * x + math.sin(progress * 7) * 4
            d.line([(rocket_x, rocket_y+35), (rocket_x, rocket_y)], fill=(*color, 180), width=2)
            d.ellipse((rocket_x-2, rocket_y-3, rocket_x+2, rocket_y+3), fill=(255, 250, 225, 255))
        if age < 0 or age > 2.1:
            continue
        for angle, speed, life, phase in sparks:
            if age > life:
                continue
            def position(a):
                travel = size * speed * 3.3 * (1-math.exp(-a*1.7))
                return (width*x+math.cos(angle)*travel, height*y+math.sin(angle)*travel+size*.05*a*a)
            px, py = position(age)
            fade = min(1, (life-age)*1.5) * min(1, age*15+.4)
            fade *= min(1, max(0, (DURATION-.15-t)*3))
            shimmer = .8 + .2*math.sin(age*22+phase)
            a = int(255*fade*shimmer)
            for step in range(7, 0, -1):
                tail_a = max(0, age-step*.035)
                tail_b = max(0, age-(step-1)*.035)
                d.line([position(tail_a), position(tail_b)], fill=(*color, int(a*(1-step/9))), width=max(2, round(size/300)))
            if a > 125:
                d.ellipse((px-2, py-2, px+2, py+2), fill=(255, 250, 227, a))
    glow = canvas.filter(ImageFilter.GaussianBlur(4))
    glow.putalpha(glow.getchannel("A").point(lambda a: min(255, a*2)))
    return Image.alpha_composite(glow, canvas)


def render(output, width, height):
    output.parent.mkdir(parents=True, exist_ok=True)
    # QuickTime Animation stores full alpha and is decoded by the existing OBS FFmpeg source.
    process = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pixel_format", "rgba", "-video_size", f"{width}x{height}",
        "-framerate", str(FPS), "-i", "pipe:0", "-an", "-c:v", "qtrle", "-pix_fmt", "argb", str(output)], stdin=subprocess.PIPE)
    try:
        for n in range(round(FPS*DURATION)):
            process.stdin.write(frame(n/FPS, width, height).tobytes())
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError("Could not render fireworks")
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
    preview = Image.new("RGBA", (width, height), (10, 14, 26, 255))
    preview = Image.alpha_composite(preview, frame(2.3, width, height))
    preview.convert("RGB").save(output.with_suffix(".preview.jpg"))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("output", type=Path)
    p.add_argument("--width", type=int, default=1080)
    p.add_argument("--height", type=int, default=1920)
    a = p.parse_args()
    render(a.output, a.width, a.height)
