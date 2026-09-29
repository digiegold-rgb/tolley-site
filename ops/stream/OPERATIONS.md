# Streaming operator guide

Updated September 29, 2026. Shared instructions for Jared and the agents maintaining Treasure Hauls. Available in HQ → Docs → Streaming setup & nightly checklist, and from the stream controls.

## Today's scope and readiness

Use one DJI camera for the first test. Defer extra cameras and the other camera connections until later. The requested Facebook phase is now installed as an unpublished preview; public activation still waits for Jared. Prepare the preview first; Jared starts the public show when ready. A request to get ready is not permission to publish immediately or after an assumed countdown.

The DJI USB connection is **not verified**. Windows did not enumerate a DJI or UVC camera, and the camera did not offer its usual USB mode menu. The Windows USB controller reported healthy. The top case port is not proven faulty; check camera power, Webcam mode, a data-capable cable, and the port connection before changing software. Confirm the model and which computer it is connected to. Do not claim a working DJI preview until it is visible.

The house was later observed disarmed, with a camera-gone auto-end in its log. Check current status before testing; these notes are a dated observation, not a live status display.

## What each machine does

For the house feed: camera → UGREEN NAS relay → Spark OBS → UGREEN finished-program relay → Windows OBS → Whatnot. The Spark builds the finished picture, audio, camera cuts and fallback slates. Windows runs the Whatnot connection. The UGREEN relays and records; it is not the video compositor.

Larix phones publish SRT to the house relay. A DJI publishing through Mimo must use its configured house input. A DJI plugged into Windows in USB Webcam mode is a separate, direct camera path: it does **not** automatically pass through the Spark or inherit the house BRB, Privacy or camera switching. Establish which path is being tested before comparing delay.

The Spark can send the finished house program to YouTube and Facebook through separate destinations. On September 29 the owner API verified the YouTube channel as **Digital Gold Jelly Studio** (`UCd4bJKIvbGOIAT-GK4K-3_w`), not a separately verified Treasure Hauls YouTube channel. TikTok currently uses LIVE Studio on Windows. A running sender, an open application and a platform-confirmed public broadcast are different states.

## What the buttons do

| Control | Meaning |
| --- | --- |
| Arm house | Allows camera connections and prepares the house program; also starts selected, configured destinations. For rehearsal, leave all destinations off and LIVE Studio unchecked. |
| YouTube | Selects the YouTube sender. While armed, enabling it can immediately send video; YouTube's visibility and auto-start settings determine public availability. Verify the intended channel and visibility first. |
| Privacy | Replaces house camera/audio with the privacy slate. It does not make a platform's audience private and does not cover a direct USB camera in TikTok. |
| Hold to END STREAM | Ends the house pipeline and closes LIVE Studio. End the platform shows first. |
| Facebook LIVE | Creates an unpublished preview on the verified Page. Send house feed starts only the Facebook sender; publish separately in Live Producer when ready. |
| Whatnot checklist | Explains how to connect the correct nightly show on Windows. Arming the house does not start a Whatnot show. |

When all house cameras disconnect for over five seconds, the Spark switches to BRB. A camera returning restores the picture. With another camera connected, the director can switch to it automatically. After all cameras are gone for 15 minutes, the house ends; the normal maximum session is eight hours. The user observed BRB preserve the downstream stream during a camera disconnect. Do not generalize this to a direct USB feed.

## Start the correct Whatnot show each night

1. Create or select the scheduled show in Whatnot Seller Hub. A show URL saved in the Tolley schedule is a link, not an OBS credential or a broadcast command.
2. On the stream page, arm the house with destinations off and LIVE Studio unchecked. Start the house camera. Confirm the Windows OBS **Program** scene has picture and a moving **House Program** audio meter.
3. Use [Chrome Remote Desktop](https://remotedesktop.google.com/access) to open the Windows stream PC. Open Chrome there, then Whatnot Seller Hub → Show OBS Tools.
4. Select the **Whatnot Live (Recommended)** profile in Windows OBS. Connect Show Tools to that OBS websocket immediately before the show. If requested, use the password from that Windows OBS instance, not the Spark's.
5. Select tonight's show and click **Start Show in Show Tools**. Whatnot supplies that show's changing stream credentials; there is no nightly stream key to paste into tolley.io/stream. Keep the tab open.
6. Confirm the show is actually live in Whatnot. Manage auctions and Whatnot chat there. End the show in Whatnot before ending the house.

If Whatnot requests an updated recommended profile, apply it while off-air, close and reopen Windows OBS, then reconnect Show Tools. Confirm the vertical canvas and WHIP service. A long-idle connection can require refreshing Show Tools and reconnecting. Do not restart OBS during a running show. These steps follow the [Whatnot OBS guide](https://help.whatnot.com/hc/en-us/articles/5497980244749-Using-OBS-with-your-Livestream).

The director's Whatnot “not configured” refers to its unused legacy RTMP destination; it cannot determine whether the Windows WHIP show is live. Never replace the current workflow with the legacy Whatnot key form.

## Single-camera picture, audio and delay test

1. Establish the route: house input with Spark processing, or DJI USB directly into Windows. First get the DJI recognized and its preview working. Do not run two capture applications against the same USB device unless sharing is verified.
2. Check picture and audio in the source preview. For the house path, also inspect the finished Windows OBS program. Keep playback speakers muted or use headphones to avoid echo.
3. Clap once on camera and say the time. Compare visible hand contact with the sound to check audio/video alignment. Do not change sync offsets merely because the whole stream arrives late.
4. With Jared's explicit readiness and the correct audience selected, start the chosen platform. Watch from a separate viewer device/account and measure the time between the real action and its appearance. OBS preview alone does not measure platform delay. Record the source-to-OBS delay and OBS-to-viewer delay separately; no delay value has been measured yet.
5. For a house-path rehearsal, briefly interrupt only that camera after confirming the test scope. Verify BRB, then reconnect and verify recovery. This is not applicable to a DJI source used directly in LIVE Studio.

Whatnot's seller account in its mobile app may act as a controller rather than showing the viewer video; use another viewer account for that measurement.

## TikTok: audio repaired, camera eligibility still blocked

Observed in LIVE Studio 1.36.6 on September 29: this account requires **one more LIVE Studio broadcast lasting at least 25 minutes** to unlock virtual-camera use. The app explicitly says mobile LIVE streams do not count and validation can take up to 48 hours. Recheck the account's current message; this is not a universal rule for every TikTok account.

The visible picture came from the **obs64.exe window-capture source**. The separate **Camera** source selected OBS Virtual Camera but had no available resolution. Seeing the captured OBS window did not satisfy TikTok's camera requirement. The earlier assumption that the red Camera label was harmless was incorrect.

For a qualifying hardware-camera broadcast, Windows must first detect an eligible physical camera and LIVE Studio must show it working. A USB DJI may provide that source once connected correctly. Neither its detection nor TikTok acceptance has been verified.

Visibility choices observed were Everyone, Friends, Select people and Super Fan. There was no verified Only me mode. An empty Select people list was not established as a usable private broadcast. Do not call it private or assume a private/practice session counts toward eligibility. Prior tests were left offline. Jared later said he may go public when ready, which is not permission to start immediately.

The working audio route for the **house/OBS feed** is Windows OBS monitoring → **CABLE Input (VB-Audio Virtual Cable)** → LIVE Studio microphone **CABLE Output (VB-Audio Virtual Cable)**. House Program uses **Monitor and Output**, unmuted. OBS Virtual Camera carries video; the cable supplies audio separately. The direct DJI test still needs its chosen microphone verified.

Troubleshooting evidence:

- The cable device initially reported error 10. Restarting its existing device nodes restored usable endpoints without installing drivers or rebooting. One duplicate node still showed an error; do not remove devices blindly.
- The saved OBS profile named CABLE Input, but the active monitoring output was still Default. In OBS Audio settings, selecting Default and **Apply**, then CABLE Input and **Apply**, corrected the active route. Merely reading the saved setting or switching away and back without applying was insufficient.
- LIVE Studio's CABLE Output meter then moved; a short local, unrecorded audio probe measured nonzero signal. Its extra Realtek desktop-speaker input was muted and audio monitoring left off to avoid duplicate sound.
- OBS was actively sending to Whatnot during this repair. No OBS reinstall, second OBS instance or public TikTok broadcast was needed.

## Larix subscriptions for later cameras

The current house SRT setup needs **Larix Broadcaster Premium**, not the NDI subscription. Premium removes the watermark and time limit. The official FAQ allows up to ten devices sharing one Apple ID or one Google account; iOS and Android purchases are separate. Use Restore purchases if an eligible device has not activated. Recheck current pricing and terms in the [Larix Premium FAQ](https://softvelum.com/larix/premium/).

## Facebook LIVE and combined chat

The Facebook destination and comments reader are installed on the Spark. The owner-only stream page has a **Facebook LIVE** panel. Facebook Page **1156652300855210**, currently **Ruthann’s Treasure Haul**, was reverified through the existing Page token on September 29. Reading its live-video list, video ownership and comments endpoint succeeded. Existing clip publishing is independent of this live sender.

An unpublished preview was created: **Treasure Hauls — house preview**, live-video ID **122117051781297240**. Meta returned `UNPUBLISHED`; the house and Facebook sender were left off. This is dated evidence: recheck `/status.facebook` before operating. The complete camera → Facebook picture/audio path and real viewer comments on both platforms still need an authorized live test. No public Facebook show was started during installation.

### Nightly Facebook workflow

1. In [stream controls](/stream), open **Facebook LIVE**. Check the Page name, enter the title and click **Create Facebook preview**. An existing unpublished preview is reused; its title is retained. For a show made in Facebook, open “Select an existing Facebook show” and enter its live-video ID. IDs from other Pages are rejected.
2. **Arm house** with other destinations off and LIVE Studio unchecked. Start the camera and confirm the house preview/audio. Initial selections now default off.
3. Click **Send house feed to preview**. Open [Facebook Live Producer](https://www.facebook.com/live/producer/?page_id=1156652300855210), choose the same Page and preview, and check picture and sound. The ingest credential stays on the Spark; there is no stream key to copy through the website.
4. When Jared is ready for viewers, click **Go live in Facebook Live Producer**. The website never performs this publish action. The Facebook panel changes to “Live on Facebook” only after Meta reports `LIVE`. “Sending” alone is not live confirmation. An unpublished preview is not an audience privacy setting; the public show’s audience is controlled in Facebook.
5. Facebook comments appear beside YouTube and TikTok messages with platform, sender and timestamp. They follow the selected Facebook live-video ID and only read while Meta reports it live. If no author name is supplied, “Facebook viewer” is shown. Whatnot chat remains in Seller Hub. Stream Coach currently saves YouTube/TikTok only; Facebook comments are displayed in the combined panel, not added to Coach’s saved sessions yet.
6. End Facebook in Live Producer, then stop the Facebook sender or end the house after all platform shows have ended. Stopping video transport does not explicitly end the Facebook show.

The sender cannot start from a generic destination toggle or a remembered selection. A director restart disables Facebook sending. If an already-public show needs reconnecting, select its ID and use **Resume public Facebook feed**, which asks for explicit confirmation before forwarding picture/audio. The house’s BRB and Privacy slates are part of the same finished program sent to Facebook. Privacy is not a platform audience control.

### Recovery and validation

- Expired token: reconnect the exact Page in social settings; rerun `ops/stream/facebook/provision.mjs` with the production environment available privately. It checks the saved binding and `/me` identity and stores credentials only in the existing secure configuration. No camera or OBS passwords belong in documents or chat.
- Ambiguous preview request: creation intent is recorded before the API POST. Do not retry blindly or clear the guard. Open Live Producer, locate that preview and use its live-video ID to select it. Creating another preview does not automatically clear an uncertain previous attempt.
- Failed ownership/status checks disable forwarding. Facebook errors are displayed without returning upstream bodies or ingest credentials. FFmpeg’s Facebook output is not logged because an error can echo its ingest URL.
- The comments reader preserves its paging cursor across ordinary polling, retries from the last timestamp after a failed cursor request and suppresses replayed event IDs. Show changes clear old source messages. Chat service restarts send a new epoch so the browser cannot become stuck behind an old sequence number.
- Remaining live acceptance check: once Jared approves a public test, confirm the actual picture/audio in Facebook, send one viewer comment on Facebook and one on YouTube, verify both in the combined panel, then interrupt/reconnect the chat reader and confirm no duplicates. Do not send comments or replies as Jared without authorization.

Implementation, mocked contract tests, install and rollback instructions: `ops/stream/facebook/README.md`. All nine offline contract tests passed during installation; website browser checks are recorded in the validation handoff.

## Agent handoff and source of truth

Read `ops/stream/STREAM-AGENTS.md` or the installed `~/stream-director/agents/STREAM-AGENTS.md` before operations. Use `stream status` first and the director CLI for normal control. Live state is not persistent memory. Never copy camera keys, platform credentials or OBS websocket passwords into these notes.

This guide is the durable shared handoff. Keep it updated alongside the HQ link and stream-page directions. Today's source configuration repairs were explicitly authorized by Jared; they are not blanket permission for future agents to interrupt a live show, install software, or start a public broadcast.
