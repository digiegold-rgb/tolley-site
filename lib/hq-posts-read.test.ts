import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("HQ routes reuse house readers", () => {
  it("view-counter / video-views / post-log / dgx / ads GET call the shared loaders", async () => {
    const view = await readFile("app/api/hq/view-counter/route.ts", "utf8");
    const video = await readFile("app/api/hq/video-views/route.ts", "utf8");
    const posts = await readFile("app/api/hq/post-log/route.ts", "utf8");
    const dgx = await readFile("app/api/hq/dgx-activity/route.ts", "utf8");
    const ads = await readFile("app/api/hq/ads-status/route.ts", "utf8");
    assert.match(view, /loadViewCounter/);
    assert.match(video, /loadVideoViews/);
    assert.match(posts, /loadPostLog/);
    assert.match(dgx, /readDgxActivity/);
    assert.match(ads, /readCachedAdsSnapshot/);
    assert.match(view, /CHANNEL_KEYS/);
    assert.match(view, /export async function POST/);
  });
});

describe("Animate Socials house block", () => {
  it("owner dashboard mounts the house dump; Socials stays per-studio", async () => {
    const screen = await readFile("components/animate/screens/socials/SocialsScreen.tsx", "utf8");
    const home = await readFile("components/animate/screens/DashboardScreen.tsx", "utf8");
    const dash = await readFile("components/animate/screens/socials/HousePostsDashboard.tsx", "utf8");
    const api = await readFile("app/api/vater/socials/house/route.ts", "utf8");
    assert.equal(screen.includes("HousePostsDashboard"), false);
    assert.match(home, /HousePostsDashboard/);
    assert.match(home, /tier === 'owner'/);
    assert.equal(/fetch\(['"`]\/api\/hq\//.test(screen), false);
    assert.equal(/fetch\(['"`]\/api\/hq\//.test(home), false);
    assert.match(dash, /\/api\/vater\/socials\/house/);
    assert.equal(/fetch\(['"`]\/api\/hq\//.test(dash), false);
    assert.match(api, /isVaterOwnerUser/);
    assert.match(api, /loadHousePosts/);
    assert.match(api, /export const maxDuration/);
    assert.equal(api.includes("collectAdsSnapshot"), false);
  });

  it("does not auto-create named workspace tabs", async () => {
    const ws = await readFile("lib/vater/workspaces.ts", "utf8");
    const create = ws.slice(ws.indexOf("export async function createWorkspace"), ws.indexOf("export async function renameWorkspace"));
    assert.equal(/Ruthann|Estate|Housing|Cinema/.test(create), false);
    assert.match(create, /cleanName\(rawName/);
  });
});
