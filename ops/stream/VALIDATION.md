# September 19, 2026 implementation evidence

- Public `/live` inspected at 390px and 1440px with Playwright: no horizontal overflow or client errors.
- Signed-out GET/POST `/api/live/manage` and GET `/api/stream/status`: 401; `/stream` redirects to login.
- Owner plus valid MFA tested in isolated local database: show creation, public live confirmation, ending/removal, control-room access.
- Mock director: armed+encoding shows “Encoding · house armed”; failed cut remains on original camera and displays the 409 message; fallback microphone is labeled; successful cut updates the picture marker.
- Database concurrency: five simultaneous claims produce one reservation; rolling cap, held clips, paused settings and missing bindings are enforced. No platform calls in queue tests.
- FFmpeg synthetic fixture: 1080×1920 containment, valid duration, captions and actual audio bleep mix pass.
- Real NAS sample: 35-second excerpt of 2026-09-18_17-21-15.mp4 was blank/silent (zero transcription segments). Local vision review returned visualSafe=false, confidence .98; no sample was published.
- Read-only NAS health reports idle with file age and size; director remains disarmed with OBS connected.
- `tolley-stream-clips.service` first run exited 0. Discovery watermark excludes older recordings. Timer runs every 15 minutes when previous run is finished.
- Meta API confirms page 1156652300855210 as Ruthann’s Treasure Haul. New Whatnot referral page names treasure_hauls; old digie86 invite returns 404.

Hardware camera-drop/audio-fallback rehearsal awaits connected cameras. No real clip has yet been published through the new worker. YouTube/Instagram remain unbound because saved connections are Your KC Homes. Start time is unspecified; public copy says daily shows without inventing one. All three shows and the promotion dashboard totals were subsequently verified; the private baseline is saved under ~/.local/state/tolley-stream-clips/whatnot-baseline.md. Seller-statement settlement remains unverified, and attributed revenue is not a profit claim. No ad purchase was made. Whatnot bio was updated and its save confirmed, retaining Ruthann/Tolley branding while removing off-platform checkout promotions.

Public-show boundary tests reject clips beginning before live confirmation or ending after the show. Program filenames are UTC, verified against duration and NAS mtime; timestamp mismatch holds the recording. Production mobile/desktop and unauthenticated API gate checks passed on the initial release; final show-boundary deployment is verified separately.
