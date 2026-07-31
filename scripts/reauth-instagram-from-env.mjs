#!/usr/bin/env node
/**
 * Rebuild the Social Suite's Instagram/Facebook page tokens WITHOUT the OAuth
 * dialog. Meta put the "Jelly" app into "Feature Unavailable — updating
 * additional details" (7/31), so /api/social/oauth/facebook/start is dead —
 * but the long-lived FACEBOOK_USER_TOKEN in env is still valid and already
 * carries instagram_basic + instagram_content_publish. This script replays
 * steps 3+ of app/api/social/oauth/facebook/callback/route.ts: user token →
 * /me/accounts page tokens → PlatformConnection upserts.
 *
 * Prints NO secrets — only page names/ids and verification status.
 *
 * Usage: cd tolley-site && node --env-file=.env.local --env-file=.env scripts/reauth-instagram-from-env.mjs
 */
import { PrismaClient } from "@prisma/client";

const GRAPH = "https://graph.facebook.com/v18.0";
const ADMIN_SUBSCRIBER = "social-suite";

const userToken = process.env.FACEBOOK_USER_TOKEN?.trim();
const igBusinessId = (process.env.INSTAGRAM_BUSINESS_ID || "17841464346090938").trim();
if (!userToken) {
  console.error("FACEBOOK_USER_TOKEN missing in env");
  process.exit(1);
}

const prisma = new PrismaClient();

const pagesRes = await fetch(
  `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(userToken)}`,
);
if (!pagesRes.ok) {
  console.error(`Page list failed: ${pagesRes.status} ${await pagesRes.text()}`);
  process.exit(1);
}
const pages = (await pagesRes.json()).data ?? [];

async function save(platform, p, scopes) {
  await prisma.platformConnection.upsert({
    where: {
      subscriberId_platform_platformAccountId: {
        subscriberId: ADMIN_SUBSCRIBER,
        platform,
        platformAccountId: platform === "instagram" ? (p.instagram_business_account?.id ?? p.id) : p.id,
      },
    },
    create: {
      subscriberId: ADMIN_SUBSCRIBER,
      platform,
      platformAccountId: platform === "instagram" ? (p.instagram_business_account?.id ?? p.id) : p.id,
      platformUsername: p.name,
      accessToken: p.access_token,
      refreshToken: null,
      scopes,
      pageId: p.id,
      pageName: p.name,
      status: "active",
      lastError: null,
    },
    update: {
      platformUsername: p.name,
      accessToken: p.access_token,
      scopes,
      pageId: p.id,
      pageName: p.name,
      status: "active",
      lastError: null,
    },
  });
}

const igPage =
  pages.find((p) => p.instagram_business_account?.id === igBusinessId) ||
  pages.find((p) => !!p.instagram_business_account);

if (igPage) {
  await save("instagram", igPage, [
    "instagram_basic", "instagram_content_publish", "pages_manage_posts", "publish_video",
  ]);
  console.log(`instagram row saved: page "${igPage.name}" (${igPage.id}) → IG ${igPage.instagram_business_account?.id}`);
} else {
  console.log("WARN: no page with a linked IG business account");
}

for (const p of pages) {
  await save(`facebook_page:${p.id}`, p, ["pages_manage_posts", "pages_read_engagement"]);
  console.log(`facebook_page:${p.id} saved (${p.name})`);
}

// Verify: the saved IG page token can read the IG account and publish quota.
if (igPage) {
  const v = await fetch(
    `${GRAPH}/${igPage.instagram_business_account.id}?fields=username&access_token=${encodeURIComponent(igPage.access_token)}`,
  );
  const vj = await v.json();
  console.log(`verify IG read: ${v.ok ? "OK" : "FAIL"} → ${JSON.stringify(vj)}`);
  const q = await fetch(
    `${GRAPH}/${igPage.instagram_business_account.id}/content_publishing_limit?access_token=${encodeURIComponent(igPage.access_token)}`,
  );
  const qj = await q.json();
  console.log(`verify publish quota: ${q.ok ? "OK" : "FAIL"} → ${JSON.stringify(qj)}`);
}

await prisma.$disconnect();
