#!/usr/bin/env node
/**
 * x-scrape.mjs <handle> — scrape an X (Twitter) profile's follower count and
 * per-tweet view counts (summed → lifetime-ish views).
 *
 * Same pattern as tiktok-scrape.mjs: needs a real display (collect.mjs runs it
 * under xvfb-run) and the shared "Claude Browser" persistent profile at
 * ~/claude-browser/profile. X walls off profile timelines from anonymous
 * visitors, so someone must log into x.com in that profile once
 * (desktop launcher: ~/Desktop/Claude-Browser.desktop). After that this runs
 * unattended forever.
 *
 * Counts come from the UserTweets GraphQL responses the page itself makes —
 * no DOM parsing. Retweets are skipped (their view counts belong to the
 * original author). "Lifetime" here = sum of views over tweets the timeline
 * scroll reached; X only counts views since ~Dec 2022 anyway.
 *
 * Prints one JSON line to stdout:
 *   { followers, statusesCount, itemsSeen, totalViews, loggedIn }
 * totalViews is null when no tweets were captured (login wall / empty page).
 */
import { chromium } from "playwright-core";

const HANDLE = process.argv[2];
if (!HANDLE) { console.error("usage: x-scrape.mjs <handle>"); process.exit(1); }

const PROFILE_DIR = "/home/jelly/claude-browser/profile";
const CHROME = "/home/jelly/.cache/ms-playwright/chromium-1217/chrome-linux/chrome";

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  executablePath: CHROME,
  headless: false,
  viewport: { width: 1280, height: 900 },
  locale: "en-US",
  args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
});

// Walk any GraphQL timeline payload and yield tweet result objects.
function* tweetResults(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) yield* tweetResults(n); return; }
  if (node.__typename === "Tweet" || (node.rest_id && node.legacy && node.views)) yield node;
  for (const v of Object.values(node)) if (v && typeof v === "object") yield* tweetResults(v);
}

try {
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const items = new Map(); // tweet rest_id -> view count
  let followers = null;
  let statusesCount = null;

  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/graphql/")) return;
    const isTweets = /UserTweets|UserMedia|UserOriginalsTimeline|ProfileSpotlights/.test(url);
    const isUser = /UserByScreenName/.test(url);
    if (!isTweets && !isUser) return;
    try {
      const j = JSON.parse(await res.text());
      if (isUser) {
        const user = j?.data?.user?.result;
        const followerCount = user?.relationship_counts?.followers ?? user?.legacy?.followers_count;
        const tweetCount = user?.tweet_counts?.tweets ?? user?.legacy?.statuses_count;
        if (followerCount != null && Number.isSafeInteger(Number(followerCount))) followers = Number(followerCount);
        if (tweetCount != null && Number.isSafeInteger(Number(tweetCount))) statusesCount = Number(tweetCount);
        return;
      }
      for (const t of tweetResults(j)) {
        // Retweets carry the ORIGINAL tweet's views — not ours, skip.
        if (t.legacy?.retweeted_status_result) continue;
        // Only count the profile owner's own tweets (quoted/embedded tweets
        // from other users also appear in the payload tree).
        const sn = t.core?.user_results?.result?.legacy?.screen_name
          ?? t.core?.user_results?.result?.core?.screen_name;
        if (!sn || sn.toLowerCase() !== HANDLE.toLowerCase()) continue;
        const count = t.views?.count;
        if (count == null || !Number.isSafeInteger(Number(count)) || Number(count) < 0) continue;
        items.set(t.rest_id, Number(count));
      }
    } catch { /* non-JSON or truncated body — ignore */ }
  });

  await page.goto(`https://x.com/${HANDLE}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(6000);

  const loggedIn = (await ctx.cookies("https://x.com")).some(
    (c) => c.name === "auth_token" && c.value,
  );

  // Scroll until the timeline stops yielding new tweets (4 quiet rounds) or cap.
  let stale = 0, last = 0;
  for (let i = 0; i < 120 && stale < 4 && items.size; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1400);
    if (items.size === last) stale++; else { stale = 0; last = items.size; }
  }

  const totalViews = items.size
    ? [...items.values()].reduce((s, v) => s + v, 0)
    : null;

  console.log(JSON.stringify({
    followers,
    statusesCount,
    itemsSeen: items.size,
    totalViews,
    loggedIn,
  }));
} finally {
  await ctx.close();
}
