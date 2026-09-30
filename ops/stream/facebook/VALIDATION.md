# September 29 Facebook phase validation

- Existing Treasure Hauls binding and Page-token `/me` both returned Page `1156652300855210`, Ruthann’s Treasure Haul.
- Page live-video listing, a previous video’s `from.id`, and its comments endpoint returned success. No viewer comments were submitted.
- Created video `122117051781297240` with `status=UNPUBLISHED`, `published=false`. A subsequent Graph read confirmed `UNPUBLISHED`, correct owner and selected title.
- Owner YouTube API verified `UCd4bJKIvbGOIAT-GK4K-3_w`, Digital Gold Jelly Studio; no active YouTube show.
- Nine offline Facebook contract tests passed: preview status/idempotency, ambiguous-create guard, wrong Page/video rejection, ingest/status gates, expired-token redaction, comment paging/reconnect/show changes, authenticated readiness and explicit public-feed resume, director generic-start guards, chat epoch/pagination/source reset.
- Seventeen existing automatic-coach tests passed after chat changes.
- Browser tests passed at 390px and 1440px: owner/MFA gate, no horizontal overflow/client errors, visible Whatnot workflow, Facebook prepare/send payloads, disabled send before house ready, merged Facebook/YouTube messages, deduplication, restart/source cleanup, and API Origin/body-size guards. All broadcast APIs were mocked in the browser; no test sent a real stream.
- The first browser run timed out during cold Next compilation; warmed rerun found an Origin-vs-internal-host mismatch. Corrected to compare browser Origin with HTTP Host, then the full test passed.
- TypeScript, changelog and link audit passed. Existing link-audit write-only-model warnings are unrelated.
- Spark services installed while idle and confirmed active. Authenticated status and local chat respond; epoch reset is reported. `stream facebook status` verifies the selected unpublished preview and disabled/stopped sender.
- Local screenshots: `/tmp/stream-checklist-mobile.png`, `/tmp/stream-facebook-desktop.png` (mock data).
- Source backups: `~/stream-director/facebook-backup-1790722952` is the pre-feature director/chat; subsequent timestamped backups contain the newer integration. No credentials are included.

No camera → Facebook ingest/audio test, real live viewer message or public broadcast was performed. These are the remaining acceptance steps when Jared is ready. Website deployment evidence is appended after release.

## September 29 (late) — pasted Live Producer stream key

- Jared created tonight's show in Live Producer and supplied its RTMPS server, primary and backup keys (video ID `122117077251297240`). Authorized read-only Graph probes with the Page token: `GET /122117077251297240` → HTTP 400, code 100, subcode 33; the Page `live_videos` edge (all `broadcast_status` filters) did not list it, while the Spark-made preview `122117051781297240` stayed readable and `UNPUBLISHED`. Conclusion: Live Producer videos are invisible to the token until live, so a paste-the-key path was added.
- Twelve offline contract tests pass (the nine above plus manual-key storage/redaction, bad-input and running-sender rejection, and the `KEYED` phase/send gate including the switch back to graph mode).
- Installed while the house was disarmed and nothing was sending (`install.py --check`, then `install.py`; backup `~/stream-director/facebook-backup-1790742400`). Both services active afterwards; status first showed the Spark preview in `graph` mode (tail `pGYEO9`).
- Keys loaded with `stream facebook key --stdin`. `stream facebook status`: video `122117077251297240`, phase `KEYED`, `ingest manual`, sender configured/off, key tail `lnDlzO`; `stream.env` still mode 600; no key text in director logs or journal.
- No arming, sending or publishing was performed. Remaining acceptance with Jared: arm → send → confirm picture/audio in Live Producer → Go Live there → panel shows Live on Facebook and comments arrive.

## September 30 — one-click go-live and hidden-video throttle

- Added `POST /facebook/golive` / `/facebook/end` and the stream-page **Hold to GO LIVE on Facebook** / **End Facebook show** buttons at Jared's request. Meta confirmed `ingest_streams{stream_health}` (with `video_bitrate`) is readable with the Page token on both the Spark preview and a past VOD, so publish waits for real incoming video (or 15 s of sending). Thirteen offline tests pass, including publish/end, refused publish with redaction, timeout, house-drop cancellation and auto-end when the house ends.
- After ~45 minutes of 15-second status polling on the hidden Live Producer video, Meta answered that ID with `(#4) Application request limit reached` while `/me` and other objects stayed at 6% usage. The director showed the Facebook panel unverified. Fixed: manual mode treats code 4 on the video lookup as hidden and rechecks a hidden video once a minute. Reinstalled while idle (backup `~/stream-director/facebook-backup-1790745162`); status returned to `KEYED`, key tail `lnDlzO`.
- No show was armed, sent or published.
