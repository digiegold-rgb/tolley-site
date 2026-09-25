#!/usr/bin/env node
/**
 * Push tolley.io URLs to IndexNow (Bing) from the terminal.
 *   npm run indexnow                      # every URL in the live sitemap
 *   npm run indexnow -- --urls /cleanouts,/estate
 * Needs INDEXNOW_KEY in the environment (same value Vercel serves at /indexnow-key.txt).
 */
const HOST = "www.tolley.io";
const key = (process.env.INDEXNOW_KEY || "").trim();
if (!key) { console.error("INDEXNOW_KEY is not set (vercel env pull, or export it)"); process.exit(2); }
const i = process.argv.indexOf("--urls");
let urls;
if (i > -1 && process.argv[i + 1]) {
  urls = process.argv[i + 1].split(",").map(s => s.trim()).filter(Boolean).map(u => (u.startsWith("/") ? `https://${HOST}${u}` : u));
} else {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(u => u.startsWith(`https://${HOST}/`));
}
const served = await fetch(`https://${HOST}/indexnow-key.txt`).then(r => (r.ok ? r.text() : "")).catch(() => "");
if (served.trim() !== key) console.warn(`warning: /indexnow-key.txt serves "${served.trim() || "(nothing)"}" — the endpoint will reject until the deployed key matches`);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/indexnow-key.txt`, urlList: urls }),
});
console.log(`IndexNow HTTP ${res.status} — ${urls.length} URLs`);
if (res.status !== 200 && res.status !== 202) { console.error(await res.text()); process.exit(1); }
