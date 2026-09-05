/**
 * Server-side Modal client for Qwen-Image-Edit-2511 stills.
 *
 * Tokens stay in Vercel env (MODAL_TOKEN_ID / MODAL_TOKEN_SECRET). Never import
 * this from a client component and never echo tokens in API responses.
 */

import {
  cardToModalKwargs,
  type GenerateJobCard,
  type ModalSpawnKwargs,
} from "@/lib/generate-job-card";
import { classifyStoredOutput } from "@/lib/generate-output";

export const MODAL_APP_DEFAULT = "tolley-qwen-image-edit";
export const MODAL_FUNCTION_DEFAULT = "qwen_image_edit";

export type ModalCallResult = {
  status?: string;
  output_urls?: string[];
  output_png_b64?: string[];
  outputs_ready?: boolean;
  error?: string | null;
};

export function isModalConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.MODAL_TOKEN_ID || "").trim() && (env.MODAL_TOKEN_SECRET || "").trim());
}

export function modalPublicStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  app: string;
  functionName: string;
  recipe: "qwen-image-edit-2511";
} {
  return {
    configured: isModalConfigured(env),
    app: (env.MODAL_APP_NAME || "").trim() || MODAL_APP_DEFAULT,
    functionName: (env.MODAL_FUNCTION_NAME || "").trim() || MODAL_FUNCTION_DEFAULT,
    recipe: "qwen-image-edit-2511",
  };
}

export function buildWebhookUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = (env.GENERATE_WEBHOOK_URL || "").trim();
  if (explicit) return explicit;
  const app = (env.APP_URL || env.AUTH_URL || env.NEXTAUTH_URL || "").trim().replace(/\/+$/, "");
  if (!app) return undefined;
  return `${app}/api/generate/webhook`;
}

export function spawnKwargsForCard(
  card: GenerateJobCard,
  extras?: { job_id?: string; webhook_url?: string },
): ModalSpawnKwargs {
  return cardToModalKwargs(card, extras);
}

function createModalClient(env: NodeJS.ProcessEnv = process.env) {
  const tokenId = (env.MODAL_TOKEN_ID || "").trim();
  const tokenSecret = (env.MODAL_TOKEN_SECRET || "").trim();
  if (!tokenId || !tokenSecret) {
    throw new Error("Modal is not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET.");
  }
  // Dynamic import keeps the gRPC SDK off Edge/client graphs.
  return import("modal").then(({ ModalClient }) => {
    return new ModalClient({
      tokenId,
      tokenSecret,
      environment: (env.MODAL_ENVIRONMENT || "").trim() || undefined,
    });
  });
}

export async function spawnQwenImageEdit(
  kwargs: ModalSpawnKwargs,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ callId: string }> {
  const client = await createModalClient(env);
  const status = modalPublicStatus(env);
  const fn = await client.functions.fromName(status.app, status.functionName);
  const call = await fn.spawn([], kwargs);
  return { callId: call.functionCallId };
}

export async function pollModalCall(
  callId: string,
  env: NodeJS.ProcessEnv = process.env,
  timeoutMs = 1500,
): Promise<{ pending: true } | { done: true; result: ModalCallResult }> {
  const client = await createModalClient(env);
  const call = await client.functionCalls.fromId(callId);
  try {
    const result = (await call.get({ timeoutMs })) as ModalCallResult;
    return { done: true, result: result && typeof result === "object" ? result : { status: "done" } };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const message = err instanceof Error ? err.message : String(err);
    if (name === "FunctionTimeoutError" || /timeout/i.test(message)) {
      return { pending: true };
    }
    throw err;
  }
}

export function normalizeOutputUrls(result: ModalCallResult | null | undefined): string[] {
  if (!result?.output_urls) return [];
  return result.output_urls.filter((u) => {
    if (typeof u !== "string" || !u.trim()) return false;
    const kind = classifyStoredOutput(u.trim());
    return kind === "spark" || kind === "private-blob";
  });
}
