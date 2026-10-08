import { prisma } from "@/lib/prisma";
import { TREASURE_PAGE } from "./core";
export class MetaRejected extends Error {}
export async function connection() {
  const c = await prisma.platformConnection.findFirst({ where: { subscriberId: "social-suite", platform: `facebook_page:${TREASURE_PAGE}`, platformAccountId: TREASURE_PAGE, status: "active" } });
  if (!c) throw new Error("Reconnect Ruthann’s Treasure Haul in Social. Its Page connection is missing.");
  return c;
}
// Mutations are single-shot. A timeout never causes another paid/public request.
export async function graph(path: string, token: string, body?: URLSearchParams) {
  const r = await fetch(`https://graph.facebook.com/v23.0/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}` }, body, signal: AbortSignal.timeout(20000), cache: "no-store" });
  const d = await r.json();
  if (d.error) throw new MetaRejected(`Meta rejected the request (HTTP ${r.status}, code ${Number(d.error.code) || "unknown"}). ${String(d.error.message || "").replace(token, "[redacted]").slice(0, 180)}`);
  if (!r.ok) throw new Error(`Meta request was not confirmed (HTTP ${r.status}).`);
  return d;
}
export async function verifyPage() {
  const c = await connection();
  const page = await graph(`${TREASURE_PAGE}?fields=id,name,followers_count`, c.accessToken);
  if (page.id !== TREASURE_PAGE) throw new Error("Connected Facebook Page does not match Treasure Haul.");
  return { connection: c, label: String(page.name), followers: Number.isSafeInteger(page.followers_count) ? page.followers_count : null };
}
