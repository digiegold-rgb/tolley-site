/**
 * Image generation helper — routes between AI Studio and Vertex AI based on model.
 *
 * - `gemini-*-image*` (Nano Banana 1/2/Pro): AI Studio via GEMINI_API_KEY. Nano
 *   Banana 2 and Pro are AI Studio exclusives, so we prefer this path.
 * - `imagen-*`: Vertex AI via GCP service account (not on AI Studio).
 *
 * Env:
 *   GEMINI_API_KEY    — AI Studio paid-tier key (jared@yourkchomes.com project)
 *   GCP_SA_KEY_JSON   — Vertex service account JSON (for Imagen only)
 *   GCP_PROJECT_ID    — defaults to tolley-io-489904 (Vertex path)
 *   GCP_LOCATION      — defaults to us-central1 (Vertex path)
 */
import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

type SAKey = {
  client_email: string;
  private_key: string;
  private_key_id: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function loadSA(): SAKey {
  const raw = process.env.GCP_SA_KEY_JSON;
  if (!raw) throw new Error("GCP_SA_KEY_JSON not set");
  const sa = JSON.parse(raw) as SAKey;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GCP_SA_KEY_JSON missing client_email or private_key");
  }
  return sa;
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function mintAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const sa = loadSA();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const claim = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = b64url(signer.sign(sa.private_key));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Vertex token mint failed ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return cachedToken.value;
}

export interface VertexImageRequest {
  model: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
}

export interface VertexImageResult {
  buffer: Buffer;
  mimeType: string;
}

function vertexBaseUrl(): string {
  const project = process.env.GCP_PROJECT_ID || "tolley-io-489904";
  const location = process.env.GCP_LOCATION || "us-central1";
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models`;
}

async function generateViaAIStudio({
  model,
  prompt,
  temperature,
  timeoutMs,
}: Required<Pick<VertexImageRequest, "model" | "prompt" | "temperature" | "timeoutMs">>): Promise<VertexImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseModalities: ["IMAGE"] },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`AI Studio image gen ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (p: { inlineData?: { mimeType: string; data: string } }) =>
      p.inlineData?.mimeType?.startsWith("image/"),
  );
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `No image in AI Studio response. First 500 chars: ${JSON.stringify(data).slice(0, 500)}`,
    );
  }
  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType,
  };
}

async function generateViaImagen({
  model,
  prompt,
  aspectRatio,
  timeoutMs,
}: Required<Pick<VertexImageRequest, "model" | "prompt" | "timeoutMs">> & {
  aspectRatio: VertexImageRequest["aspectRatio"];
}): Promise<VertexImageResult> {
  const token = await mintAccessToken();
  const url = `${vertexBaseUrl()}/${model}:predict`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio ?? "16:9",
        safetySetting: "block_only_high",
        personGeneration: "allow_adult",
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Vertex Imagen gen ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const pred = data?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded;
  if (!b64) {
    throw new Error(
      `No image in Vertex Imagen response. First 500 chars: ${JSON.stringify(data).slice(0, 500)}`,
    );
  }
  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: pred.mimeType || "image/png",
  };
}

export async function generateImage(req: VertexImageRequest): Promise<VertexImageResult> {
  const timeoutMs = req.timeoutMs ?? 120_000;
  if (req.model.startsWith("imagen-")) {
    return generateViaImagen({
      model: req.model,
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      timeoutMs,
    });
  }
  return generateViaAIStudio({
    model: req.model,
    prompt: req.prompt,
    temperature: req.temperature ?? 0.8,
    timeoutMs,
  });
}
