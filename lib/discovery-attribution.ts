export type Attribution = {
  version: 1;
  campaignSource?: string;
  campaignMedium?: string;
  campaignName?: string;
  shareSource?: string;
  browserSource: string;
  referrerHost?: string;
  landingPath: string;
  reportedSource?: string;
};
const domains: [string, string[]][] = [
  ["chatgpt", ["chatgpt.com", "chat.openai.com"]], ["claude", ["claude.ai"]],
  ["perplexity", ["perplexity.ai"]], ["gemini", ["gemini.google.com"]],
  ["copilot", ["copilot.microsoft.com"]], ["google", ["google.com"]],
  ["bing", ["bing.com"]], ["facebook", ["facebook.com", "fb.com"]],
  ["instagram", ["instagram.com"]], ["tiktok", ["tiktok.com"]],
  ["twitter", ["twitter.com", "x.com"]], ["youtube", ["youtube.com", "youtu.be"]],
  ["reddit", ["reddit.com"]], ["linkedin", ["linkedin.com"]],
  ["nextdoor", ["nextdoor.com"]], ["craigslist", ["craigslist.org"]],
  ["offerup", ["offerup.com"]], ["yelp", ["yelp.com"]], ["internal", ["tolley.io"]],
];
export function classifyReferrer(ref: string): string {
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname.toLowerCase();
    return domains.find(([, ds]) => ds.some(d => host === d || host.endsWith("." + d)))?.[0] ?? "other";
  } catch { return "other"; }
}
const short = (v: unknown, max = 120): string | undefined => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
export function normalizeAttribution(input: unknown): Attribution | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const v = input as Record<string, unknown>;
  const host = short(v.referrerHost, 253);
  const safeHost = host && /^[a-z0-9.-]+$/i.test(host) ? host.toLowerCase() : undefined;
  return { version: 1, campaignSource: short(v.campaignSource), campaignMedium: short(v.campaignMedium), campaignName: short(v.campaignName), shareSource: short(v.shareSource),
    browserSource: safeHost ? classifyReferrer(`https://${safeHost}`) : "direct", referrerHost: safeHost,
    landingPath: typeof v.landingPath === "string" && v.landingPath.startsWith("/") && !v.landingPath.startsWith("//") ? v.landingPath.split(/[?#]/)[0].slice(0, 300) : "/",
    reportedSource: short(v.reportedSource, 300),
  };
}
export function captureAttribution(url: string, referrer: string): Attribution {
  const u = new URL(url);
  let referrerHost: string | undefined;
  try { referrerHost = new URL(referrer).hostname; } catch { /* no referral evidence */ }
  return normalizeAttribution({ campaignSource: u.searchParams.get("utm_source"), campaignMedium: u.searchParams.get("utm_medium"), campaignName: u.searchParams.get("utm_campaign"), shareSource: u.searchParams.get("ref"), referrerHost, landingPath: u.pathname })!;
}
export function attributionSource(a?: Attribution): string {
  return a?.campaignSource || a?.shareSource || a?.browserSource || "direct";
}
export function reportedSourceKey(value?: string): string | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (/chat\s?gpt|openai/.test(v)) return "chatgpt";
  for (const name of ["claude", "perplexity", "gemini", "copilot", "google", "facebook", "friend", "other"]) if (v.includes(name)) return name;
  return "other";
}
