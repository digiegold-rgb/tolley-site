import { prisma } from "@/lib/prisma";
import { classifyModalOutputs, serializeJobOutputUrls } from "@/lib/generate-output";
import { durableUrlsFromModalResult } from "@/lib/generate-output-persist";
import { type ModalCallResult } from "@/lib/generate-modal";
import { isGenerateJobStatus, type GenerateJobStatus } from "@/lib/generate-job-card";
import { gpuJobFinishFields } from "@/lib/gpu-job-log";

export function serializeJob(row: {
  id: string;
  status: string;
  recipe: string;
  cardJson: unknown;
  modalCallId: string | null;
  outputUrls: string[];
  error: string | null;
  createdBy: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  backend?: string | null;
  kind?: string | null;
  durationMs?: number | null;
  costUsd?: number | null;
}) {
  return {
    id: row.id,
    status: row.status,
    recipe: row.recipe,
    card: row.cardJson,
    modal_call_id: row.modalCallId,
    // Never hand the browser a public Blob CDN URL (or a raw Spark/private path).
    output_urls: serializeJobOutputUrls(row.id, row.outputUrls),
    error: row.error,
    createdBy: row.createdBy,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    backend: row.backend ?? "modal",
    kind: row.kind ?? null,
    durationMs: row.durationMs ?? null,
    costUsd: row.costUsd ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Wall time + Modal cost (or null) for a terminal GenerateJob update. */
export async function generateJobFinishPatch(
  jobId: string,
  result?: unknown,
): Promise<{
  completedAt: Date;
  durationMs: number | null;
  costUsd: number | null;
  backend: string;
}> {
  const row = await prisma.generateJob.findUnique({
    where: { id: jobId },
    select: { startedAt: true, backend: true },
  });
  return gpuJobFinishFields({
    startedAt: row?.startedAt ?? null,
    backend: row?.backend,
    result,
  });
}

export async function applyModalResult(
  jobId: string,
  result: ModalCallResult,
): Promise<{
  status: GenerateJobStatus;
  outputUrls: string[];
  error: string | null;
  incomplete?: boolean;
}> {
  const classified = classifyModalOutputs(result);
  const failedHint = result.status === "failed" || Boolean(result.error);

  if (!classified.outputsReady && !failedHint) {
    return { status: "running", outputUrls: [], error: null, incomplete: true };
  }

  let outputUrls: string[] = [];
  if (classified.outputsReady) {
    try {
      outputUrls = await durableUrlsFromModalResult(jobId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.generateJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: `Still persist failed: ${message}`.slice(0, 2000),
          ...(await generateJobFinishPatch(jobId, result)),
        },
      });
      return { status: "failed", outputUrls: [], error: message };
    }
  }

  const failed = failedHint || Boolean(result.error && !outputUrls.length);
  const status: GenerateJobStatus = failed ? "failed" : "done";
  const error = result.error ? String(result.error).slice(0, 2000) : null;

  if (status === "done" && !outputUrls.length) {
    return { status: "running", outputUrls: [], error: null, incomplete: true };
  }

  await prisma.generateJob.update({
    where: { id: jobId },
    data: {
      status,
      outputUrls,
      error,
      ...(await generateJobFinishPatch(jobId, result)),
    },
  });
  return { status, outputUrls, error };
}

export function coerceStatus(value: unknown): GenerateJobStatus | null {
  return typeof value === "string" && isGenerateJobStatus(value) ? value : null;
}
