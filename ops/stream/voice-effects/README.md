# Spoken fireworks

Say **“fireworks”**, with a brief natural pause, into the microphone currently on air. The local recognizer also accepts “firework” and its recognized spelling “fire work.” Finalized recognition requests one 5.8-second transparent burst through the director. A 12-second cooldown prevents repeated explosions. This is a visual effect; there is no sound effect to compete with the host.

The service listens to the finished program audio on Spark. Spark's Live scene contains a transparent FFmpeg media source above the cameras, so the finished feed sent through the Windows OBS/Whatnot WHIP connection contains the effect. No Windows installation, OBS browser plugin, paid speech service, Shopify connection, or in-show click is required.

## Behavior

- Auto-listens only while the director is armed, OBS is sending the Live scene, program ingest is ready, a microphone camera is connected, and privacy is off. It also works in a deliberately armed local rehearsal.
- Off-air/private/disconnected/stale director status stops the audio reader. Buffered speech is discarded when stopping or switching microphone/show; it is never flushed as a new cue.
- Speech cannot run commands, change scenes, start/end broadcasts, or choose files. Only the fixed fireworks source is restarted, by the director.
- Keyword confidence must be at least 0.80. Unrelated words and weak recognitions are ignored. No forced keyword-only grammar is used, which avoids interpreting every sound as the cue.
- The listener reads already-aired audio, so other people/music/video on that feed can also say the cue. This is keyword recognition, not speaker identification.
- No audio or full transcripts are stored or sent to a cloud. Only the last matched keyword/time and the director's effect event are retained in memory. Existing program recordings continue according to the house settings.
- Detection takes a brief pause plus the existing feed delay; synthetic “fireworks” fixtures finalized around 0.7–1 second after the word. Actual microphone/noise performance must be checked in rehearsal. “Fireworks” was more consistent than the singular in the synthetic voice tests.
- The animation starts/ends transparent and clears at end. A 6.2-second wall-clock expiry also stops hidden/paused effects, so an old cue cannot reappear when returning from BRB. It does not cover privacy/BRB/Ending scenes. After an OBS profile/scene reset, rerun installation while idle to restore the source.

## Controls

```
stream effects status
stream effects off
stream effects on
stream effects test
```

Settings persist across restarts. `test` restarts only the fireworks media source while the house and OBS outputs are idle; it does not select Live or start a show. To see it in OBS, select the Live scene while outputs are stopped, run the test, then restore the previous scene. The standalone preview MP4 can be viewed without touching OBS. All director effects routes require the existing API key. The worker is bound only to loopback port 8110.

## Install on Spark

Read `ops/stream/STREAM-AGENTS.md`. The installer refuses an armed/encoding/sending house and rechecks before OBS changes. It adds a small director route module and restarts the director only when required; existing camera/stream keys stay in their original config files.

1. Create `~/stream-director/.voice-venv` with `python3 -m venv`, then install `requirements.txt` there.
2. Download [vosk-model-small-en-us-0.15](https://alphacephei.com/vosk/models) (Apache 2.0) into `~/.cache/tolley-voice/vosk-model-small-en-us-0.15`. The local model is about 40 MB to download.
3. Run `.voice-venv/bin/python render.py ~/.local/share/tolley-stream-effects/fireworks-portrait.mov`. The generator creates original graphics with full alpha, no audio, at 1080×1920/30 fps. It also writes a dark-background preview JPEG. Use width/height arguments if the scene changes orientation.
4. Run `.voice-venv/bin/python -m unittest discover -s ops/stream/voice-effects -v` from the repository. The audio fixtures need FFmpeg's installed `flite` filter; production only needs normal RTSP/audio decoding.
5. Run `~/stream-director/.venv/bin/python ops/stream/voice-effects/install.py` from the repository. The existing director venv supplies its already-installed OBS client. The separate voice venv does not replace director dependencies.
6. Verify `stream effects status`: modelReady true, enabled true, state idle while off-air. Off-air effect requests must be rejected. During the next authorized rehearsal, verify `listening`, say “fireworks,” and check the Windows OBS picture and mic volume.

Installation doesn't start cameras, OBS output, recording, or any platform show. No MediaMTX configuration is changed. The additive director module and CLI backups use `.before-voice-<timestamp>` names.

## Rollback

`stream effects off` stops listening immediately and persists that preference. To remove it, while idle stop/disable `tolley-voice-effects`, remove only the Voice Fireworks scene item/input, and remove the marked director import/install call or restore its matching backup if no subsequent edits occurred. Restore the CLI backup only if it has no newer changes. Do not revert unrelated director updates or delete program recordings.

References: [Vosk installation](https://alphacephei.com/vosk/install), [Vosk models](https://alphacephei.com/vosk/models), [OBS media source](https://obsproject.com/kb/media-sources).
