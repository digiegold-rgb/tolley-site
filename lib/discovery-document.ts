/** Inspect the actual HTML response, excluding scripts (including Next's RSC payload). */
export function htmlAttributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
}
export function discoveryDocumentIssues(html: string, expectedUrl: string): string[] {
  const issues: string[] = [];
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const metas = [...markup.matchAll(/<meta\b[^>]*>/gi)].map(m => htmlAttributes(m[0]));
  const canonicals = [...markup.matchAll(/<link\b[^>]*>/gi)].map(m => htmlAttributes(m[0])).filter(a => a.rel?.toLowerCase() === "canonical");
  if (!/<title\b[^>]*>\s*[^<\s]/i.test(markup)) issues.push("Page title missing");
  if (!/<h1\b[^>]*>/i.test(markup)) issues.push("Page heading missing from server HTML");
  if (!metas.some(a => a.name?.toLowerCase() === "description" && a.content?.trim())) issues.push("Description missing");
  if (metas.some(a => ["robots", "googlebot", "bingbot"].includes(a.name?.toLowerCase()) && /\b(noindex|none)\b/i.test(a.content || ""))) issues.push("Page is noindex");
  if (canonicals.length !== 1) issues.push("Expected one canonical URL");
  else {
    try {
      if (new URL(canonicals[0].href).href !== new URL(expectedUrl).href) issues.push(`Canonical URL does not match ${expectedUrl}`);
    } catch { issues.push("Invalid canonical URL"); }
  }
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (htmlAttributes(match[1]).type !== "application/ld+json") continue;
    try { JSON.parse(match[2]); } catch { issues.push("Invalid structured data JSON"); }
  }
  return issues;
}

/** Accept only canonical, same-site page URLs; never follow arbitrary sitemap origins. */
export function discoverySitemapPaths(xml: string, origin: string): string[] {
  const paths = new Set<string>();
  for (const m of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
    try {
      const url = new URL(m[1].trim());
      if (url.origin === origin && !url.search && !url.hash && !url.pathname.startsWith("/api/")) paths.add(url.pathname);
    } catch { /* malformed entries cannot become fetch targets */ }
  }
  return [...paths];
}
