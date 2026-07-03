import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { backAtYouHealth } from "@/lib/social/backatyou";

export const dynamic = "force-dynamic";

type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest"
  | "backatyou";

interface ConnectionStatus {
  platform: Platform;
  state: "connected" | "missing" | "expired" | "error";
  account?: string;
  lastUsed?: string;
  message?: string;
}

function checkFacebook(): ConnectionStatus {
  const tokens = [
    process.env.FACEBOOK_PAGE_TOKEN_TREASURE,
    process.env.FACEBOOK_PAGE_TOKEN_WD,
    process.env.FACEBOOK_PAGE_TOKEN_RE,
    process.env.FACEBOOK_PAGE_TOKEN_MAIN,
  ].filter(Boolean);

  if (tokens.length === 0) {
    return {
      platform: "facebook",
      state: "missing",
      message: "No FACEBOOK_PAGE_TOKEN_* env vars set",
    };
  }

  return {
    platform: "facebook",
    state: "connected",
    account: `ruthann.legg@gmail (${tokens.length} pages)`,
  };
}

function checkInstagram(): ConnectionStatus {
  const igBusinessId = process.env.INSTAGRAM_BUSINESS_ID;
  const fbToken = process.env.FACEBOOK_PAGE_TOKEN_TREASURE || process.env.FACEBOOK_PAGE_TOKEN_MAIN;

  if (!fbToken) {
    return {
      platform: "instagram",
      state: "missing",
      message: "Needs FB connection (IG Business runs through Graph)",
    };
  }
  if (!igBusinessId) {
    return {
      platform: "instagram",
      state: "missing",
      message: "Set INSTAGRAM_BUSINESS_ID env var (IG Business linked to FB Page)",
    };
  }

  return {
    platform: "instagram",
    state: "connected",
    account: `IG Business ${igBusinessId.slice(0, 6)}…`,
  };
}

function checkPinterest(): ConnectionStatus {
  // Prefer the DGX Selenium service (drives pin-creation-tool via the
  // existing snap-chromium session — works even though our dev app
  // got trial-denied for direct API write access).
  if (process.env.PINTEREST_SERVICE_URL && process.env.PINTEREST_SERVICE_API_KEY) {
    return {
      platform: "pinterest",
      state: "connected",
      account: "Via DGX Selenium service (jaredtolley)",
    };
  }
  if (process.env.PINTEREST_ACCESS_TOKEN) {
    return {
      platform: "pinterest",
      state: "connected",
      account: process.env.PINTEREST_ACCOUNT || "jared@yourkchomes",
    };
  }
  return {
    platform: "pinterest",
    state: "missing",
    message: "DGX cron handles posting today; PINTEREST_ACCESS_TOKEN not in tolley-site",
  };
}

function checkYouTube(): ConnectionStatus {
  const refresh = process.env.YOUTUBE_REFRESH_TOKEN;
  const clientId = process.env.YOUTUBE_CLIENT_ID;

  if (!refresh || !clientId) {
    return {
      platform: "youtube",
      state: "missing",
      message: "Needs OAuth re-auth — see playbook step 1",
    };
  }
  return {
    platform: "youtube",
    state: "connected",
    account: process.env.YOUTUBE_CHANNEL_NAME || "YT Brand account",
  };
}

function checkTikTok(): ConnectionStatus {
  // Prefer the DGX Selenium service when configured — it bypasses the
  // multi-week video.publish review for the official API.
  if (process.env.TIKTOK_SERVICE_URL && process.env.TIKTOK_SERVICE_API_KEY) {
    return {
      platform: "tiktok",
      state: "connected",
      account: "Via DGX Selenium service",
    };
  }
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      platform: "tiktok",
      state: "missing",
      message: "One-time login needed — see playbook step 2",
    };
  }
  return {
    platform: "tiktok",
    state: "connected",
    account: process.env.TIKTOK_ACCOUNT || "TikTok",
  };
}

async function checkBackAtYou(): Promise<ConnectionStatus> {
  if (!process.env.BACKATYOU_API_KEY) {
    return {
      platform: "backatyou",
      state: "missing",
      message: "BACKATYOU_API_KEY not set in Vercel env",
    };
  }
  const health = await backAtYouHealth();
  if (!health.ok) {
    return {
      platform: "backatyou",
      state: "error",
      message: health.error || "Service unreachable",
    };
  }
  return {
    platform: "backatyou",
    state: "connected",
    account: health.logged_in ? "Session warm" : "Service ready (will login on first post)",
  };
}

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const connections: ConnectionStatus[] = await Promise.all([
    Promise.resolve(checkYouTube()),
    Promise.resolve(checkTikTok()),
    Promise.resolve(checkInstagram()),
    Promise.resolve(checkFacebook()),
    Promise.resolve(checkPinterest()),
    checkBackAtYou(),
  ]);

  return NextResponse.json({ connections });
}
