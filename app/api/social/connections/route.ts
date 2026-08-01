import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { tiktokServiceHealth } from "@/lib/social/tiktok";

export const dynamic = "force-dynamic";

type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest";

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

async function checkTikTok(): Promise<ConnectionStatus> {
  // Prefer the DGX Selenium service when configured — it bypasses the
  // multi-week video.publish review for the official API. Actually ping it:
  // env presence alone showed "connected" for 11 days while every post died.
  if (process.env.TIKTOK_SERVICE_URL && process.env.TIKTOK_SERVICE_API_KEY) {
    const health = await tiktokServiceHealth();
    if (!health.ok) {
      return {
        platform: "tiktok",
        state: "error",
        message: health.error || "DGX TikTok service unreachable",
      };
    }
    const accounts = health.accounts ?? {};
    const summary = Object.entries(accounts)
      .map(([name, a]) =>
        a.logged_in ? `${name} ✓ (${a.days_left}d)` : `${name} ✗ needs login`,
      )
      .join(", ");
    const anyLoggedIn = Object.values(accounts).some((a) => a.logged_in);
    return {
      platform: "tiktok",
      state: anyLoggedIn || health.logged_in ? "connected" : "expired",
      account: summary || "Via DGX Selenium service",
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

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const connections: ConnectionStatus[] = await Promise.all([
    Promise.resolve(checkYouTube()),
    checkTikTok(),
    Promise.resolve(checkInstagram()),
    Promise.resolve(checkFacebook()),
    Promise.resolve(checkPinterest()),
  ]);

  return NextResponse.json({ connections });
}
