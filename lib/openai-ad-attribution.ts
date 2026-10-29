/** Opaque ad-click reference, separate from campaign and customer attribution. */
export function openAIReference(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !/\s|[\u0000-\u001f\u007f]/.test(value)
    ? value : undefined;
}

export function measurementDenied(gpc: unknown, dnt: unknown): boolean {
  return gpc === true || gpc === "1" || dnt === "1" || dnt === "yes";
}

export function cleanoutConversion(leadId: string, reference: unknown, timestamp = Date.now()) {
  const oppref = openAIReference(reference);
  if (!oppref || !leadId) return undefined;
  return {
    id: `cleanouts_quote_${leadId}`,
    type: "lead_created",
    timestamp_ms: timestamp,
    oppref,
    source_url: "https://www.tolley.io/cleanouts",
    action_source: "web",
    opt_out: true,
    data: { type: "customer_action" },
  };
}
