/** Free dependency check before a scheduled render buys scripts or keyframes. */
export async function requireRenderDependencies(comfyUrl, fetcher = fetch) {
  const response = await fetcher(`${comfyUrl.replace(/\/$/, '')}/system_stats`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Render dependency unavailable (HTTP ${response.status}); no generation started.`);
  const body = await response.json();
  if (!body || !Array.isArray(body.devices)) throw new Error('Render dependency returned an invalid health response; no generation started.');
}
