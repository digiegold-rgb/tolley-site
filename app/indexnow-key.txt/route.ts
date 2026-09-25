import { indexNowKey } from "@/lib/indexnow";
/** IndexNow ownership proof: the key file must be served at the keyLocation we submit. */
export function GET() {
  const key = indexNowKey();
  if (!key) return new Response("Not configured", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
