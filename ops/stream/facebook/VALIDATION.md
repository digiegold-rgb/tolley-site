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
