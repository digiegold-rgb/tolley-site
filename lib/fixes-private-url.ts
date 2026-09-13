/** Fixed deployment setting, never supplied by a request or callback parameter. */
export function fixesPrivateUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".ts.net") || url.hostname === "ts.net" || url.username || url.password || url.port || url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}
