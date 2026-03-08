export const AGENT_URL = process.env.AGENT_URL || "http://localhost:3002";

export async function postToAgent<TPayload extends Record<string, unknown>>(
  path: string,
  payload: TPayload,
) {
  return fetch(`${AGENT_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
}
