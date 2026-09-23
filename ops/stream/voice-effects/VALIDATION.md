# Validation — September 23, 2026

- 15 Python tests pass in the isolated `.voice-venv`: actual synthesized PCM recognition with two voices, singular spelling, normal sales speech/similar words, silence, confidence threshold, cooldown across reconnects, duplicate finals, authenticated director requests, privacy/off-air/no-mic rejection, old-show and stale cues, replay, preview restrictions, wall-clock expiry, and transparent first/last frames.
- Rendered 1080×1920, 30 fps, 5.8-second QuickTime Animation source. FFprobe reports `qtrle`/`argb`, with no audio stream.
- Installed the separate user service on Spark. `stream effects status` reports enabled, modelReady, idle, no error, and no captured audio while off-air.
- Production HTTP checks: missing API key rejected (401); normal cue rejected off-air (409); enabled setting round-trip works.
- An explicitly off-air OBS preview selected Live with streaming and recording stopped, restarted only the effect, captured it at media cursor 2333 ms, and confirmed it stopped after wall-clock expiry. The original Ending scene was restored. No broadcast or recording was started.
- Real OBS source PNG during playback had alpha extrema `(0,255)`; after expiry it had `(0,0)` and an empty alpha bounding box. The effect actually clears rather than leaving a black rectangle or final frame.
- Read-only Windows inspection confirmed the current Stream scene collection's House Program input reads the finished program feed. No Windows software, OBS settings, or Whatnot controls were changed.

**Still requires a microphone rehearsal:** no cameras were connected during installation. Verify recognition of the host's actual voice, noise level, and the picture arriving in Windows OBS before relying on it in a Whatnot show. Speech recognition can miss cues or respond to the cue spoken in other on-air audio; it is not speaker identification.

Preview assets on Spark:

- `~/.local/share/tolley-stream-effects/fireworks-preview.mp4` — dark-background viewing copy.
- `~/.local/share/tolley-stream-effects/fireworks-portrait.mov` — transparent OBS source.
- `/tmp/tolley-fireworks-obs.png`, `/tmp/tolley-fireworks-cleared.png` — actual OBS verification captures.
