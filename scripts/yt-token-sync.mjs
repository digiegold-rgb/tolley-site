// Watch tolley-site DB for a fresh YouTube refresh token (saved by the
// /api/social/oauth/youtube/callback after Jared's re-auth click), verify it
// against Google, then sync it into the DGX youtube.env used by the trend
// engine / listings-video / socialite pipelines.
// Run from /home/jelly/tolley-site so .env + @prisma/client resolve.
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const ENV_FILE = "/home/jelly/.openclaw/workspace-socialite/credentials/youtube.env";
const prisma = new PrismaClient();

const deadToken = (readFileSync(ENV_FILE, "utf8").match(/^YOUTUBE_REFRESH_TOKEN=(.*)$/m) || [])[1]?.trim();
const env = readFileSync(ENV_FILE, "utf8");
const clientId = (env.match(/^YOUTUBE_CLIENT_ID=(.*)$/m) || [])[1]?.trim();
const clientSecret = (env.match(/^YOUTUBE_CLIENT_SECRET=(.*)$/m) || [])[1]?.trim();

async function verify(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  return d.access_token ? true : (console.log("verify failed:", d.error, d.error_description), false);
}

const DEADLINE = Date.now() + 90 * 60 * 1000; // give up after 90 min
for (;;) {
  const row = await prisma.platformConnection.findFirst({
    where: { subscriberId: "social-suite", platform: "youtube", status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  const fresh = row?.refreshToken;
  if (fresh && fresh !== deadToken && (await verify(fresh))) {
    copyFileSync(ENV_FILE, ENV_FILE + ".bak");
    writeFileSync(
      ENV_FILE,
      env.replace(/^YOUTUBE_REFRESH_TOKEN=.*$/m, `YOUTUBE_REFRESH_TOKEN=${fresh}`),
    );
    console.log(`SYNCED fresh token (updatedAt ${row.updatedAt.toISOString()}) → ${ENV_FILE} (old saved as .bak)`);
    break;
  }
  if (Date.now() > DEADLINE) {
    console.log("TIMEOUT: no new valid youtube token appeared in 90 min");
    process.exit(1);
  }
  console.log(new Date().toISOString(), "no new token yet; sleeping 60s");
  await new Promise((r) => setTimeout(r, 60_000));
}
await prisma.$disconnect();
