#!/usr/bin/env python3
"""build-music.py — real looping soundtrack for Portal Hoppers: Blocky Worlds. $0, local ACE-Step on the GB10.

Run: ~/bitcoin-kids/.venv-audio/bin/python scripts/game/build-music.py [ids...]
Per track: N takes × SECONDS via ACE-Step ([inst], no lyrics) → whisper vocal gate (fewest words wins)
→ cut to whole bars ≤ 75 s with a 60 ms equal-power crossfade → .ogg (vorbis q3) + .m4a (aac 96k)
→ public/game/music/manifest.json.
"""
import json, os, subprocess, sys, time
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/game/music"
WORK = Path(os.environ.get("MUSIC_WORK", "/tmp/claude-1000/-home-jelly/4ca86298-cf2c-4e1d-8283-47911ed469b9/scratchpad/music"))
TAKES = int(os.environ.get("MUSIC_TAKES", "3"))
GATE = os.environ.get("MUSIC_GATE", "off")  # "cuda" | "cpu" | "off" — CPU whisper takes 5+ min per take on the GB10
SECONDS = float(os.environ.get("MUSIC_SECONDS", "80"))
LOOP_MAX = 75.0

TRACKS = {
    "title": (120, "playful chiptune orchestral adventure theme, bright marimba and 8-bit lead melody, heroic brass stabs, warm strings, upbeat kids video game title screen, clean mix, no vocals, instrumental, 120 bpm"),
    "factory": (128, "industrial toy factory electro swing, clanking metallic percussion, bouncy upright bass, muted brass, mechanical gear rhythms, steam hiss hits, cheerful mischievous video game level music, instrumental, no vocals, 128 bpm"),
    "star": (110, "dreamy space disco, shimmering arpeggios, cosmic pads, four-on-the-floor groove, twinkling bells, wonder and awe, kids video game level music, instrumental, no vocals, 110 bpm"),
    "falling": (100, "soaring wind orchestral, sweeping strings, flutes, light timpani, open sky freedom, descending motifs, adventurous video game level music, instrumental, no vocals, 100 bpm"),
    "water": (96, "underwater synthwave, deep bubbly bass, chorus-drenched electric piano, Labyrinth Zone feel, mysterious and calm with tension, video game level music, instrumental, no vocals, 96 bpm"),
    "pipes": (118, "funky plumbing bossa nova, wah guitar, clavinet, bongos, playful brass, pipes clanging percussion, cheerful video game level music, instrumental, no vocals, 118 bpm"),
    "bouncy": (160, "bouncy ska pop, upstroke guitar, horn section, fast trampoline energy, hyper cheerful kids video game level music, instrumental, no vocals, 160 bpm"),
    "danger": (170, "tense drum and bass with sirens, aggressive breakbeats, warning klaxon stabs, pulsing bass, high alert video game level music, instrumental, no vocals, 170 bpm"),
    "candy": (132, "candy shop swing, sugary vibraphone, bubbly xylophone, big band horns, sweet and silly kids video game level music, instrumental, no vocals, 132 bpm"),
    "dark": (80, "dark music box lullaby, eerie celesta, reversed piano, deep sub drone, upside down haunted but kid friendly, slow video game level music, instrumental, no vocals, 80 bpm"),
    "between": (140, "glitchy remix medley, chopped samples, stuttering edits, chiptune and orchestral mashup, bitcrushed drums, chaotic final world video game music, instrumental, no vocals, 140 bpm"),
    "boss": (150, "epic boss battle, pounding taiko drums, synth brass fanfare, driving bass, urgent heroic video game boss music, instrumental, no vocals, 150 bpm"),
    "finale": (132, "triumphant victory march, full orchestra with brass fanfare, snare rolls, glockenspiel, celebration ending credits video game music, instrumental, no vocals, 132 bpm"),
}
PRIORITY = ["title", "factory", "boss", "finale", "star", "falling", "water", "pipes", "bouncy", "danger", "candy", "dark", "between"]


def vocal_score(wav: Path) -> int:
    """Whisper base: count confident words. Instrumental tracks score 0. -1 = gate off."""
    if GATE == "off":
        return -1
    try:
        subprocess.run([os.path.expanduser("~/.local/bin/whisper"), str(wav), "--model", "base", "--device", GATE, "--fp16", "True" if GATE == "cuda" else "False",
                        "--output_format", "json", "--output_dir", str(wav.parent), "--verbose", "False"],
                       check=True, capture_output=True, timeout=900)
        data = json.loads((wav.parent / (wav.stem + ".json")).read_text())
        words = 0
        for seg in data.get("segments", []):
            if seg.get("no_speech_prob", 1) < 0.5 and seg.get("avg_logprob", -9) > -1:
                words += len(seg.get("text", "").split())
        return words
    except Exception as e:  # noqa: BLE001
        print("whisper failed", wav, e)
        return 0


def make_loop(wav: Path, bpm: float) -> tuple[np.ndarray, int, float]:
    audio, sr = sf.read(str(wav), dtype="float32", always_2d=True)
    bar = 240.0 / bpm
    bars = int(LOOP_MAX // bar)
    length = bars * bar
    # skip the first bar (ACE-Step intros swell) so the loop seam lands on a downbeat
    start = int(round(bar * sr))
    n = int(round(length * sr))
    if start + n > len(audio):
        start = 0
        n = min(n, len(audio))
    seg = audio[start : start + n].copy()
    xf = int(0.06 * sr)
    head = seg[:xf].copy()
    tail = seg[-xf:].copy()
    t = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    seg[:xf] = head * np.sin(t * np.pi / 2) + tail * np.cos(t * np.pi / 2)
    seg = seg[:-xf]
    # gentle normalize
    peak = float(np.abs(seg).max()) or 1.0
    seg *= min(1.0, 0.92 / peak)
    return seg, sr, len(seg) / sr


def encode(loop_wav: Path, tid: str):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(loop_wav), "-c:a", "libvorbis", "-q:a", "3", str(OUT / f"{tid}.ogg")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(loop_wav), "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(OUT / f"{tid}.m4a")], check=True)


def main():
    ids = [a for a in sys.argv[1:] if a in TRACKS] or PRIORITY
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    from acestep.pipeline_ace_step import ACEStepPipeline

    pipe = ACEStepPipeline(dtype="bfloat16")
    for tid in ids:
        bpm, prompt = TRACKS[tid]
        best = None
        for rnd in range(2):
            for take in range(TAKES):
                seed = 1000 * (PRIORITY.index(tid) + 1) + rnd * 10 + take
                wav = WORK / f"{tid}-{rnd}-{take}.wav"
                t0 = time.time()
                if not wav.exists():
                    pipe(audio_duration=SECONDS, prompt=prompt, lyrics="[inst]", infer_step=27, guidance_scale=15,
                         scheduler_type="euler", omega_scale=10, manual_seeds=[seed], save_path=str(wav))
                score = vocal_score(wav)
                print(f"{tid} r{rnd} take{take} seed={seed} words={score} {time.time()-t0:.0f}s", flush=True)
                if best is None or score < best[0]:
                    best = (score, wav, take, seed)
            if best[0] <= 3 or GATE == "off":
                break
        score, wav, take, seed = best
        seg, sr, secs = make_loop(wav, bpm)
        loop_wav = WORK / f"{tid}-loop.wav"
        sf.write(str(loop_wav), seg, sr)
        encode(loop_wav, tid)
        manifest[tid] = {"id": tid, "seconds": round(secs, 3), "bpm": bpm, "take": take, "seed": seed, "vocalScore": score, "prompt": prompt}
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"== {tid}: {secs:.1f}s loop written", flush=True)
    print("done", list(manifest))


if __name__ == "__main__":
    main()
