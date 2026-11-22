import test from "node:test";
import assert from "node:assert/strict";
import { discoveryDocumentIssues, discoverySitemapPaths } from "../lib/discovery-document";
import { checkDiscoveryHealth } from "../lib/discovery-health";
const page = (path: string) => `<html><head><title>A useful page</title><meta content="A useful description" name="description"><link href="https://www.tolley.io${path}" rel="canonical"></head><body><h1>Useful answers</h1></body></html>`;
test("crawler inspection checks real canonical tags, reversed attributes, headings, and robots", () => {
  assert.deepEqual(discoveryDocumentIssues(page("/wd/terms"), "https://www.tolley.io/wd/terms"), []);
  const wrong = page("/wd").replace('<h1>Useful answers</h1>', '<script>"<h1>Not public HTML</h1>"</script>') + '<meta content="noindex, follow" name="robots"><script type="application/ld+json">broken</script>';
  const issues = discoveryDocumentIssues(wrong, "https://www.tolley.io/wd/terms");
  assert.ok(issues.some(s => s.startsWith("Canonical URL does not match")));
  assert.ok(issues.includes("Page heading missing from server HTML"));
  assert.ok(issues.includes("Page is noindex"));
  assert.ok(issues.includes("Invalid structured data JSON"));
});
test("sitemap targets reject foreign origins, API paths, queries and duplicates", () => {
  const xml = ["https://www.tolley.io/blog/example", "https://evil.example/private", "https://www.tolley.io/api/private", "https://www.tolley.io/shop?delete=1", "https://www.tolley.io/blog/example"].map(s => `<loc>${s}</loc>`).join("");
  assert.deepEqual(discoverySitemapPaths(xml, "https://www.tolley.io"), ["/blog/example"]);
});
test("daily health covers nested sitemap pages and each search crawler policy", async () => {
  const seen: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input)), path = url.pathname; seen.push(path);
    const body = path === "/robots.txt" ? "User-agent: *\nAllow: /\nUser-agent: Claude-SearchBot\nDisallow: /blog/\n# OAI-SearchBot" : path === "/sitemap.xml" ? "<urlset><url><loc>https://www.tolley.io/blog/example</loc></url></urlset>" : page(path);
    const response = new Response(body, { headers: path === "/blog/example" ? { "x-robots-tag": "noindex" } : {} });
    Object.defineProperty(response, "url", { value: url.href }); return response;
  }) as typeof fetch;
  const result = await checkDiscoveryHealth("https://www.tolley.io", fetcher);
  assert.ok(seen.includes("/blog/example"));
  const nested = result.find(r => r.path === "/blog/example")!;
  assert.equal(nested.ok, false);
  assert.ok(nested.issues.includes("Response header is noindex"));
  assert.ok(nested.issues.includes("Claude-SearchBot disallowed by robots.txt"));
});

import robots from "../app/robots";
import { crawlAllowed } from "../lib/discovery-robots";
test("public knowledge queries remain crawlable without opening nested API routes", () => {
  const rules = robots().rules;
  const group = Array.isArray(rules) ? rules[0] : rules;
  const text = `User-agent: *\n${(group.allow as string[]).map(p => `Allow: ${p}`).join('\n')}\n${(group.disallow as string[]).map(p => `Disallow: ${p}`).join('\n')}`;
  assert.equal(crawlAllowed(text, "/api/v1/knowledge?q=washer", "OAI-SearchBot"), true);
  assert.equal(crawlAllowed(text, "/api/v1/knowledge/private", "OAI-SearchBot"), false);
  assert.equal(crawlAllowed(text, "/api/hq/customers", "OAI-SearchBot"), false);
});
