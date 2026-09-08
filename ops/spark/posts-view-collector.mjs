#!/usr/bin/env node
/**
 * collect.mjs — hourly channel view/subscriber collector for the /hq Posts-tab
 * view counter (tolley.io/hq?tab=posts).
 *
 * Pulls, per channel:
 *   - YouTube (both channel-scoped tokens): lifetime viewCount + subscriberCount
 *     via channels.list, plus daily views via the Analytics API where the token
 *     carries yt-analytics.readonly (@yourkchome does; ruthann's 403s and is
 *     skipped — its windows come from cumulative snapshots instead).
 *   - Facebook: followers_count + page_video_views daily series.
 *   - TikTok (@digitaljared): headless scrape via tiktok-scrape.mjs under
 *     xvfb-run using the shared Claude Browser profile (~/claude-browser).
 *     Followers always; lifetime views only while that profile is logged in
 *     to tiktok.com (one-time desktop login, see Claude-Browser.desktop).
 *
 * First run backfills the daily series (365d YT / ~90d FB — FB insights don't
 * go further back); after that each run re-pulls only the last RESETTLE_DAYS so
 * late-settling platform numbers correct themselves. state.json remembers the
 * backfill cursor per channel.
 *
 * RESETTLE_DAYS must stay comfortably wider than the slowest platform's
 * reporting lag: a day that first appears upstream AFTER it has fallen out of
 * the re-pull window is never fetched again and is lost from every window total
 * permanently. YouTube Analytics routinely runs ~3 days behind, so 3 was exactly
 * at the cliff edge.
 *
 * Pushes everything to POST tolley.io/api/hq/view-counter (x-sync-secret).
 * Cron: 40 * * * *  >> ~/growth-engine/view-counter/collect.log
 */
import { readFileSync, writeFileSync, existsSync, readlinkSync, unlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const BASE = process.env.TOLLEY_BASE || "https://www.tolley.io";
const ENV_LOCAL = "/home/jelly/tolley-site/.env.local";
const STATE_PATH = new URL("./state.json", import.meta.url).pathname;
const FB_V = "v21.0";
const RESETTLE_DAYS = 10;
// How far back to refresh per-video counts. These feed the /hq "live" numbers,
// which exist to answer "did the Short I posted this morning get views?" —
// beyond a couple of weeks the lagged Analytics windows are the better source.
const RECENT_DAYS = 14;
let trackedVideos = [];
let collectorState;
const ONLY = new Set((process.env.VIEW_CHANNELS_ONLY || "").split(",").filter(Boolean));
const selected = ch => !ONLY.size || ONLY.has(ch.key);
const metricCount = value => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
// Facebook keeps its own, longer window: the /hq "every video" leaderboard is
// the only place FB reel performance is visible at all (Meta's own Page insights
// don't count Reels-feed views — see collectFbVideos), so it's worth carrying
// half a year of them.
const FB_VIDEO_DAYS = 180;

// NOTE: youtube.env is the OLD @digitalgold channel (18K subs, dormant). It was
// wired to yt-ykh, so the "Your KC Homes" card was showing @digitalgold's
// numbers. Fixed 2026-08-03 — yt-ykh now uses the real @yourkchomes creds.
// @digitalgold gets a card again when we start posting there.
const YT_CHANNELS = [
  { key: "yt-dgd", creds: "/home/jelly/.openclaw/workspace-socialite/credentials/youtube-dgd.env" },
  { key: "yt-ykh", creds: "/home/jelly/.openclaw/workspace-socialite/credentials/youtube-kchomes.env" },
  { key: "yt-ruthann", creds: "/home/jelly/.openclaw/workspace-socialite/credentials/youtube-ruthann.env" },
  // youtube.env = the legacy @digitalgold channel (4.42M views, 18.8K subs).
  // Restored 2026-08-10 under its own key after the 8/3 repoint left its 4.4M
  // off the dashboard entirely (and pre-8/4 yt-ykh rows mislabeled).
  { key: "yt-dgold", creds: "/home/jelly/.openclaw/workspace-socialite/credentials/youtube.env" },
];
const TT_CHANNELS = [
  { key: "tt-jared", handle: "digitaljared" },
];
// X: same Claude-Browser one-time-login pattern as TikTok (x-scrape.mjs).
// Followers + views need a logged-in x.com session in that profile.
const X_CHANNELS = [
  { key: "x-ykh", handle: "yourkchomes" },
];
// Bluesky: fully public API, zero auth. No view metric exists on the platform,
// so cards get followers only. To add an account: one entry here AND a roster
// entry in tolley-site lib/view-counter.ts (deploy site first).
// Errors harmlessly ("actor not found") until the account is created.
const BSKY_CHANNELS = [
  // Tolley's Treasure Hauls — the account post-short.py has posted to since
  // 7/28. Custom-domain handle; app password in ~/dgx-services/bluesky.env.
  { key: "bsky-haul", handle: "haul.tolley.io" },
];
const TT_PROFILE_DIR = "/home/jelly/claude-browser/profile";
const FB_PAGES = [
  { key: "fb-treasure", idVar: "FACEBOOK_PAGE_ID_TREASURE", tokVar: "FACEBOOK_PAGE_TOKEN_TREASURE" },
  { key: "fb-wd", idVar: "FACEBOOK_PAGE_ID_WD", tokVar: "FACEBOOK_PAGE_TOKEN_WD" },
  { key: "fb-re", idVar: "FACEBOOK_PAGE_ID_RE", tokVar: "FACEBOOK_PAGE_TOKEN_RE" },
  // Jelly Studio = the /animate brand Page (reels only, opened 8/16). Estate =
  // Tolley Estate Sales. Both added 2026-08-17; tokens minted off
  // FACEBOOK_USER_TOKEN via /me/accounts.
  { key: "fb-jelly", idVar: "FACEBOOK_PAGE_ID_JELLY", tokVar: "FACEBOOK_PAGE_TOKEN_JELLY" },
  { key: "fb-estate", idVar: "FACEBOOK_PAGE_ID_ESTATE", tokVar: "FACEBOOK_PAGE_TOKEN_ESTATE" },
];

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function loadState() {
  try { return JSON.parse(readFileSync(STATE_PATH, "utf8")); } catch { return { lastDaily: {} }; }
}

const iso = (d) => d.toISOString().slice(0, 10);
const todayUtc = () => iso(new Date());
const daysAgo = (n) => iso(new Date(Date.now() - n * 864e5));

async function ytAccessToken(credsPath) {
  const e = parseEnv(credsPath);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.YOUTUBE_CLIENT_ID,
      client_secret: e.YOUTUBE_CLIENT_SECRET,
      refresh_token: e.YOUTUBE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`YT token refresh ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

async function collectYt(ch, state, rows) {
  const tok = await ytAccessToken(ch.creds);
  const chRes = await (await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true",
    { headers: { Authorization: `Bearer ${tok}` } },
  )).json();
  const stats = chRes.items?.[0]?.statistics;
  if (!stats) throw new Error(`no channel statistics for ${ch.key}`);
  rows.push({
    channelKey: ch.key,
    day: todayUtc(),
    totalViews: metricCount(stats.viewCount),
    subscribers: metricCount(stats.subscriberCount),
  });
  console.log(`[yt] ${ch.key}: lifetime=${stats.viewCount} subs=${stats.subscriberCount}`);

  // Before the Analytics call, which 403s on ruthann's token — the live
  // per-video numbers work on any token and must not be lost to that.
  try {
    await collectYtVideos(ch, tok, rows);
  } catch (e) {
    throw new Error(`${ch.key}: video count refresh failed`);
  }

  // Daily views via Analytics — backfill 365d once, then a rolling re-pull.
  const start = state.lastDaily[ch.key] || daysAgo(365);
  const end = todayUtc();
  const res = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${start}&endDate=${end}&metrics=views&dimensions=day&maxResults=400`,
    { headers: { Authorization: `Bearer ${tok}` } },
  );
  const j = await res.json();
  if (!res.ok) {
    console.log(`[yt] ${ch.key}: analytics unavailable (${res.status}) — snapshots only`);
    return;
  }
  for (const [day, views] of j.rows ?? []) {
    rows.push({ channelKey: ch.key, day, dayViews: Number(views) });
  }
  console.log(`[yt] ${ch.key}: ${j.rows?.length ?? 0} daily rows ${start}..${end}`);
  state.lastDaily[ch.key] = daysAgo(RESETTLE_DAYS);
}

// Per-video counts for the trailing RECENT_DAYS of uploads. Unlike the
// Analytics daily series this is near-realtime, so it is what makes a Short
// posted an hour ago visible on /hq at all. Costs ~6 quota units per channel
// per run (playlistItems + videos are 1 unit each).
async function collectYtVideos(ch, tok, rows) {
  const chRes = await (await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${tok}` } },
  )).json();
  const uploads = chRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`no uploads playlist for ${ch.key}`);

  const cutoff = Date.now() - RECENT_DAYS * 864e5;
  const ids = [];
  let pageToken = "";
  // Uploads come back newest-first, so stop at the first one older than cutoff.
  for (let i = 0; i < 6; i++) {
    const j = await (await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50&pageToken=${pageToken}`,
      { headers: { Authorization: `Bearer ${tok}` } },
    )).json();
    if (j.error) throw new Error(`playlistItems: ${j.error.message}`.slice(0, 160));
    const batch = j.items ?? [];
    let hitOld = false;
    for (const it of batch) {
      const at = Date.parse(it.contentDetails.videoPublishedAt);
      if (at >= cutoff) ids.push(it.contentDetails.videoId);
      else hitOld = true;
    }
    if (hitOld || !j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }

  const fullRefresh = Date.now() - (Date.parse(collectorState.ytFullRefreshAt?.[ch.key] || "") || 0) > 20 * 3600_000;
  if (fullRefresh) {
    ids.push(...trackedVideos.filter(v => v.channelKey === ch.key).map(v => v.videoId));
  }
  const uniqueIds = [...new Set(ids)];
  ids.splice(0, ids.length, ...uniqueIds);
  let n = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.slice(i, i + 50).join(",")}`,
      { headers: { Authorization: `Bearer ${tok}` } },
    )).json();
    if (j.error) throw new Error(`videos.list: ${j.error.message}`.slice(0, 160));
    for (const v of j.items ?? []) {
      const views = metricCount(v.statistics?.viewCount);
      if (views === null) continue; // private/unavailable counts must not erase a stored value
      rows.push({
        channelKey: ch.key,
        videoId: v.id,
        title: v.snippet.title.slice(0, 300),
        publishedAt: v.snippet.publishedAt,
        views,
        url: `https://www.youtube.com/watch?v=${v.id}`,
      });
      n++;
    }
  }
  if (fullRefresh) collectorState.ytFullRefreshAt = { ...(collectorState.ytFullRefreshAt || {}), [ch.key]: new Date().toISOString() };
  console.log(`[yt] ${ch.key}: refreshed ${n} tracked video counts${fullRefresh ? " (including older uploads)" : ""}`);
}

async function collectFb(page, env, state, rows) {
  const id = env[page.idVar];
  const tok = env[page.tokVar];
  if (!id || !tok) throw new Error(`${page.key}: missing ${page.idVar}/${page.tokVar} in .env.local`);

  const f = await (await fetch(
    `https://graph.facebook.com/${FB_V}/${id}?fields=followers_count,fan_count&access_token=${tok}`,
  )).json();
  if (f.error) throw new Error(`${page.key} page fields: ${f.error.message}`);
  const followers = Number(f.followers_count ?? f.fan_count ?? 0);
  rows.push({ channelKey: page.key, day: todayUtc(), subscribers: followers });

  // page_video_views daily — FB caps range per request, so chunk by 30 days.
  const startIso = state.lastDaily[page.key] || daysAgo(90);
  let cursor = new Date(startIso + "T00:00:00Z");
  const endMs = Date.now();
  let days = 0;
  while (cursor.getTime() < endMs) {
    const chunkEnd = Math.min(cursor.getTime() + 30 * 864e5, endMs);
    const r = await fetch(
      `https://graph.facebook.com/${FB_V}/${id}/insights?metric=page_video_views&period=day` +
      `&since=${Math.floor(cursor.getTime() / 1000)}&until=${Math.floor(chunkEnd / 1000)}&access_token=${tok}`,
    );
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`${page.key} insights: ${(j.error?.message || r.status)}`.slice(0, 200));
    for (const v of j.data?.[0]?.values ?? []) {
      // end_time is the day AFTER the day the value describes
      const day = iso(new Date(Date.parse(v.end_time) - 864e5));
      rows.push({ channelKey: page.key, day, dayViews: Number(v.value || 0) });
      days++;
    }
    cursor = new Date(chunkEnd);
  }
  console.log(`[fb] ${page.key}: followers=${followers}, ${days} daily rows since ${startIso}`);
  state.lastDaily[page.key] = daysAgo(RESETTLE_DAYS);

  await collectFbVideos(page, id, tok, rows);
}

// Per-video (per-reel) counts for a Page, plus the lifetime video-view total.
//
// Why this exists: page_video_views — the daily series above — badly undercounts
// a reels-first Page. On day two the Jelly Studio Page reported 150 there while
// its four reels had 705 views between them; Reels-feed distribution simply
// doesn't land in that metric. Summing the per-video counts is the honest
// number, and it doubles as the "which video actually worked" feed on /hq.
//
// The lifetime sum walks EVERY video (a few paged requests even on the 361-video
// Your KC Homes Page); only the trailing FB_VIDEO_DAYS are pushed as per-video
// rows, because older ones are settled history nobody scrolls to.
async function collectFbVideos(page, id, tok, rows) {
  const all = [];
  let url =
    `https://graph.facebook.com/${FB_V}/${id}/videos` +
    `?fields=id,title,description,created_time,permalink_url,views&limit=100&access_token=${tok}`;
  for (let i = 0; i < 12 && url; i++) {
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`${page.key} videos: ${(j.error?.message || r.status)}`.slice(0, 200));
    all.push(...(j.data ?? []));
    url = j.paging?.next ?? null;
  }

  // Publishing a reel also mints a shadow /videos object with the same
  // timestamp, a /<page>/videos/<id> permalink and a permanent views=0 — the
  // reel object carries the real count. Dropping every 0-view non-reel entry
  // removes the shadows exactly, and loses nothing else: a genuine video with
  // zero views contributes zero either way.
  if (all.some(v => metricCount(v.views) === null)) throw new Error(`${page.key}: incomplete video metrics; preserving previous counts`);
  const vids = all.filter(
    (v) => Number(v.views || 0) > 0 || /\/reel\//.test(v.permalink_url ?? ""),
  );

  const lifetime = vids.reduce((s, v) => s + Number(v.views || 0), 0);
  rows.push({ channelKey: page.key, day: todayUtc(), totalViews: lifetime });

  const cutoff = Date.now() - FB_VIDEO_DAYS * 864e5;
  let pushed = 0;
  for (const v of vids) {
    if (Date.parse(v.created_time) < cutoff) continue;
    // FB reels carry no title — the first line of the caption is what a human
    // would recognise the video by.
    const title =
      (v.title || (v.description ?? "").split("\n")[0] || "(untitled)").slice(0, 300);
    rows.push({
      channelKey: page.key,
      videoId: v.id,
      title,
      publishedAt: v.created_time,
      views: Number(v.views || 0),
      url: v.permalink_url ? (v.permalink_url.startsWith("http") ? v.permalink_url : `https://www.facebook.com${v.permalink_url}`) : null,
    });
    pushed++;
  }
  console.log(
    `[fb] ${page.key}: ${vids.length} videos, lifetime views=${lifetime}, ${pushed} pushed (last ${FB_VIDEO_DAYS}d)`,
  );
}

// The Claude Browser profile is shared with the desktop launcher — if Chrome
// holds it live, skip this run (hourly cron retries); if the lock is orphaned
// (crashed browser), clear it or every future run fails too.
function ttProfileBusy() {
  const lock = `${TT_PROFILE_DIR}/SingletonLock`;
  if (!existsSync(lock)) return false;
  try {
    const pid = Number(readlinkSync(lock).split("-").pop());
    if (pid) { process.kill(pid, 0); return true; } // signal 0 = liveness probe
  } catch {}
  try { unlinkSync(lock); } catch {}
  return false;
}

// Preferred path (2026-08-08): tiktok-service :9106 /scrape borrows one of the
// POSTING accounts' live sessions (ruthann/yourkchomes, ~6-month cookies) —
// any logged-in session can read any profile's play counts, so the view
// counter no longer needs its own tiktok.com login. The service serializes
// scrapes against posts with its own lock. Falls back to the old standalone
// Claude-Browser scrape only if the service is down.
async function ttScrapeViaService(handle) {
  const env = readFileSync("/home/jelly/dgx-services/tiktok-service/.env", "utf8");
  const key = env.match(/^TIKTOK_API_KEY=(.*)$/m)?.[1]?.trim();
  if (!key) throw new Error("no TIKTOK_API_KEY in tiktok-service .env");
  const res = await fetch(
    `http://127.0.0.1:9106/scrape?handle=${encodeURIComponent(handle)}`,
    { headers: { "x-api-key": key }, signal: AbortSignal.timeout(8 * 60_000) },
  );
  if (!res.ok) throw new Error(`tiktok-service /scrape HTTP ${res.status}`);
  const r = await res.json();
  if (r.error) throw new Error(`tiktok-service /scrape: ${r.error}`);
  return r;
}

async function ttScrapeStandalone(handle) {
  if (ttProfileBusy()) throw new Error("Claude Browser is open — skipped this run");
  const { stdout } = await execFileP(
    "xvfb-run", ["-a", process.execPath, new URL("./tiktok-scrape.mjs", import.meta.url).pathname, handle],
    { timeout: 8 * 60_000 },
  );
  return JSON.parse(stdout.trim().split("\n").pop());
}

async function collectTt(ch, state, rows) {
  // Throttle: the scrape borrows a POSTING account's session — don't parade it
  // past TikTok's bot detection hourly. Stats are day-granular, so ~4 full
  // scrapes/day is plenty; failed runs retry on the next hourly cron.
  const lastOk = Date.parse(state.ttLastSuccessAt?.[ch.key] ?? "") || 0;
  if (Date.now() - lastOk < 5.5 * 3600_000) {
    console.log(`[tt] ${ch.key}: scraped ${Math.round((Date.now() - lastOk) / 60000)}m ago — throttled to ~6h cadence`);
    return;
  }
  let r;
  try {
    r = await ttScrapeViaService(ch.handle);
  } catch (err) {
    console.log(`[tt] ${ch.key}: service scrape failed (${err.message}) — falling back to Claude Browser`);
    r = await ttScrapeStandalone(ch.handle);
  }

  if (r.followers) rows.push({ channelKey: ch.key, day: todayUtc(), subscribers: r.followers });

  if (r.totalViews === null) {
    const hint = r.loggedIn
      ? `grid incomplete (${r.itemsSeen}/${r.videoCount} videos)`
      : "no live session — check tiktok-service /health for a logged-in posting account";
    console.log(`[tt] ${ch.key}: followers=${r.followers ?? "?"} but no views — ${hint}`);
    if (!r.followers) throw new Error(`${ch.key}: nothing scraped — ${hint}`);
    return;
  }
  // A dip vs last run means a partial grid slipped past the completeness check.
  // 🔴 2026-08-16 this fired at exactly the wrong threshold: a scrape missing
  // ~42 of 432 videos came back 3,285,310 against 3,346,529 — 98.17% of the
  // previous total, so it cleared a 98% floor and was written. That snapshot
  // became the newest one, the 30d window computed `latest - first` = NEGATIVE,
  // the route clamped it to 0, and the biggest channel in the empire reported
  // ZERO views for 30 days.
  //
  // Two guards now, because either alone lets that through:
  //   - a lifetime view counter only goes DOWN when videos are deleted, so any
  //     drop past a hair of rounding is a bad scrape, not a real loss;
  //   - completeness is checked against the profile's own videoCount, tight
  //     enough that the missing tail can't be worth tens of thousands of views.
  const prev = state.ttLastTotal?.[ch.key] ?? 0;
  if (r.totalViews < prev * 0.995) {
    throw new Error(`${ch.key}: total ${r.totalViews} < 99.5% of last ${prev} — partial scrape, not pushing views`);
  }
  if (r.videoCount && r.itemsSeen && r.itemsSeen < r.videoCount * 0.98) {
    throw new Error(`${ch.key}: only ${r.itemsSeen}/${r.videoCount} videos scraped (<98%) — not pushing views`);
  }
  rows.push({ channelKey: ch.key, day: todayUtc(), totalViews: r.totalViews, subscribers: r.followers ?? undefined });
  state.ttLastTotal = { ...(state.ttLastTotal ?? {}), [ch.key]: r.totalViews };
  state.ttLastSuccessAt = { ...(state.ttLastSuccessAt ?? {}), [ch.key]: new Date().toISOString() };
  console.log(`[tt] ${ch.key}: lifetime=${r.totalViews} followers=${r.followers} (${r.itemsSeen}/${r.videoCount} videos, loggedIn=${r.loggedIn})`);
}

async function collectX(ch, state, rows) {
  if (ttProfileBusy()) throw new Error(`${ch.key}: Claude Browser is open — skipped this run`);
  const { stdout } = await execFileP(
    "xvfb-run", ["-a", process.execPath, new URL("./x-scrape.mjs", import.meta.url).pathname, ch.handle],
    { timeout: 8 * 60_000 },
  );
  const r = JSON.parse(stdout.trim().split("\n").pop());

  if (r.followers !== null) rows.push({ channelKey: ch.key, day: todayUtc(), subscribers: r.followers });

  if (r.totalViews === null) {
    const hint = r.loggedIn
      ? "timeline yielded no tweets"
      : "NOT LOGGED IN — open Claude Browser on the desktop and log into x.com once";
    console.log(`[x] ${ch.key}: followers=${r.followers ?? "?"} but no views — ${hint}`);
    if (r.followers === null) throw new Error(`${ch.key}: nothing scraped — ${hint}`);
    return;
  }
  // Same partial-scrape guard as TikTok: a total far below the last good run
  // means the scroll bailed early — don't poison the window baselines with it.
  const prev = state.xLastTotal?.[ch.key] ?? 0;
  if (r.totalViews < prev * 0.98) {
    throw new Error(`${ch.key}: total ${r.totalViews} < 98% of last ${prev} — partial scrape, not pushing views`);
  }
  rows.push({ channelKey: ch.key, day: todayUtc(), totalViews: r.totalViews, subscribers: r.followers ?? undefined });
  state.xLastTotal = { ...(state.xLastTotal ?? {}), [ch.key]: r.totalViews };
  console.log(`[x] ${ch.key}: lifetime=${r.totalViews} followers=${r.followers} (${r.itemsSeen} tweets seen of ${r.statusesCount} statuses, loggedIn=${r.loggedIn})`);
}

async function collectBsky(ch, rows) {
  const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(ch.handle)}`);
  const j = await res.json();
  if (!res.ok) throw new Error(`${ch.key}: getProfile ${res.status}: ${JSON.stringify(j).slice(0, 160)}`);
  rows.push({ channelKey: ch.key, day: todayUtc(), subscribers: Number(j.followersCount ?? 0) });

  // Bluesky exposes NO view metric, so the card's headline number is
  // cumulative LIKES instead — the only real reach signal here. Sum likeCount
  // across the author feed (paginated) and store it in totalViews; the card
  // labels the bluesky platform's number "likes", and the GET route's window
  // math treats it exactly like a lifetime counter (deltas per day).
  let likes = 0, cursor = "", pages = 0;
  do {
    const u = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(ch.handle)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const fr = await fetch(u);
    const fj = await fr.json();
    if (!fr.ok) break;
    for (const it of fj.feed ?? []) likes += Number(it.post?.likeCount ?? 0);
    cursor = fj.cursor ?? "";
  } while (cursor && ++pages < 20);
  rows.push({ channelKey: ch.key, day: todayUtc(), totalViews: likes });
  console.log(`[bsky] ${ch.key}: followers=${j.followersCount} posts=${j.postsCount} likes=${likes}`);
}

// LinkedIn has NO public metrics API, but it emails jared@yourkchomes.com a
// weekly "your posts got N impressions last week" digest. li-impressions.py
// reads that inbox over IMAP (same app password that sends invoices) and
// returns one row per ISO week. We store each week as a dayViews row so the
// GET route's summed-daily windows work exactly like Facebook's — 30d ≈ the
// last ~4 weekly digests, lifetime = every week we've ingested.
// Throttled to once/day (the digest is weekly; no point IMAP-scanning hourly).
const LI_CHANNELS = [
  { key: "li-jared", handle: "jared-tolley" },
];
async function collectLi(ch, state, rows) {
  const lastOk = Date.parse(state.liLastScanAt?.[ch.key] ?? "") || 0;
  if (Date.now() - lastOk < 20 * 3600_000) {
    console.log(`[li] ${ch.key}: scanned ${Math.round((Date.now() - lastOk) / 3600_000)}h ago — daily cadence`);
    return;
  }
  const { stdout } = await execFileP(
    "python3",
    [new URL("./li-impressions.py", import.meta.url).pathname],
    { timeout: 3 * 60_000 },
  );
  const weeks = JSON.parse(stdout.trim().split("\n").pop());
  if (!Array.isArray(weeks) || !weeks.length) {
    console.log(`[li] ${ch.key}: no impression digests parsed`);
    return;
  }
  for (const w of weeks) {
    rows.push({ channelKey: ch.key, day: `${w.date}T00:00:00.000Z`, dayViews: w.impressions });
  }
  state.liLastScanAt = { ...(state.liLastScanAt ?? {}), [ch.key]: new Date().toISOString() };
  const latest = weeks[0];
  const total = weeks.reduce((s, w) => s + w.impressions, 0);
  console.log(`[li] ${ch.key}: ${weeks.length} weekly digests, latest ${latest.date}=${latest.impressions}, sum=${total}`);
}

// Pinterest — v5 API is blocked (app "trial access pending"), so until it
// activates we scrape the logged-in analytics dashboard's own GraphQL feed via
// pinterest-analytics.mjs (the same Chromium profiles the pinterest-service
// posts with). Account-level impressions, stored as a daily series like FB.
// Per-board split (Hauls vs Estates on @digiegold) waits until real board data
// appears in the feed — the account is brand new and Pinterest reports
// dataStatus=PROCESSING with null metrics for now. Throttled ~daily.
const PIN_ACCOUNTS = [
  { key: "pi-homes", label: "homes", sessionDir: "/home/jelly/snap/chromium/common/pinterest_session" },
  { key: "pi-hauls", label: "hauls", sessionDir: "/home/jelly/snap/chromium/common/pinterest_treasure_session" },
];
async function collectPin(acct, state, rows) {
  const lastOk = Date.parse(state.pinLastScanAt?.[acct.key] ?? "") || 0;
  if (Date.now() - lastOk < 20 * 3600_000) {
    console.log(`[pin] ${acct.key}: scanned ${Math.round((Date.now() - lastOk) / 3600_000)}h ago — daily cadence`);
    return;
  }
  const { stdout } = await execFileP(
    process.execPath,
    [new URL("./pinterest-analytics.mjs", import.meta.url).pathname, acct.sessionDir, acct.label],
    { timeout: 4 * 60_000 },
  );
  const r = JSON.parse(stdout.trim().split("\n").pop());
  if (!r.captured) throw new Error(`${acct.key}: analytics not captured (session dead?)`);

  const days = r.byDay ?? [];
  for (const dd of days) {
    rows.push({ channelKey: acct.key, day: `${dd.date}T00:00:00.000Z`, dayViews: dd.impressions });
  }
  // Only an actual daily series counts as a successful analytics capture.
  state.pinLastScanAt = { ...(state.pinLastScanAt ?? {}), [acct.key]: new Date().toISOString() };
  console.log(`[pin] ${acct.key}: captured, status=${r.dataStatus}, days_with_data=${days.length}, 30d=${r.impressions30d ?? "—"}`);
}

function syncSecret(env) {
  if (process.env.SYNC_SECRET) return process.env.SYNC_SECRET.trim();
  if (env.SYNC_SECRET) return env.SYNC_SECRET;
  throw new Error("SYNC_SECRET not in env or tolley-site/.env.local");
}

async function main() {
  console.log(`\n=== view-counter collect ${new Date().toISOString()} ===`);
  const env = parseEnv(ENV_LOCAL);
  const state = loadState();
  collectorState = state;
  const rows = [];
  const errors = [];
  if (YT_CHANNELS.some(ch => selected(ch) && Date.now() - (Date.parse(state.ytFullRefreshAt?.[ch.key] || "") || 0) > 20 * 3600_000)) {
    const res = await fetch(`${BASE}/api/hq/video-views`, { headers: { "x-sync-secret": syncSecret(env) }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Tracked-video read failed (${res.status}); full refresh requires the Posts accuracy release`);
    const data = await res.json();
    if (!Array.isArray(data.videos)) throw new Error("Tracked-video response missing rows");
    trackedVideos = data.videos;
  }

  for (const ch of YT_CHANNELS.filter(selected)) {
    try { await collectYt(ch, state, rows); } catch (e) { errors.push(`${ch.key}: ${e.message}`); }
  }
  for (const page of FB_PAGES.filter(selected)) {
    try { await collectFb(page, env, state, rows); } catch (e) { errors.push(`${page.key}: ${e.message}`); }
  }
  for (const ch of TT_CHANNELS.filter(selected)) {
    try { await collectTt(ch, state, rows); } catch (e) { errors.push(`${ch.key}: ${e.message}`); }
  }
  for (const ch of X_CHANNELS.filter(selected)) {
    try { await collectX(ch, state, rows); } catch (e) { errors.push(`${ch.key}: ${e.message}`); }
  }
  for (const ch of BSKY_CHANNELS.filter(selected)) {
    try { await collectBsky(ch, rows); } catch (e) { errors.push(`${ch.key}: ${e.message}`); }
  }
  for (const ch of LI_CHANNELS.filter(selected)) {
    try { await collectLi(ch, state, rows); } catch (e) { errors.push(`${ch.key}: ${e.message}`); }
  }
  for (const acct of PIN_ACCOUNTS.filter(selected)) {
    try { await collectPin(acct, state, rows); } catch (e) { errors.push(`${acct.key}: ${e.message}`); }
  }
  for (const err of errors) console.error("[error]", err);
  if (!rows.length) { console.error("nothing collected — not pushing"); process.exit(1); }

  const res = await fetch(`${BASE}/api/hq/view-counter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-secret": syncSecret(env) },
    body: JSON.stringify(rows),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`push failed ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  console.log(`pushed ${rows.length} rows → upserted=${j.upserted} videos=${j.videos ?? 0} skipped=${j.skipped}`);
  if (j.skipped) throw new Error("Metric push skipped invalid rows; refresh cursors were not advanced");

  // Only advance the backfill cursor after a successful push — a failed push
  // must not orphan the historical series forever.
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  if (errors.length) process.exit(2);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
