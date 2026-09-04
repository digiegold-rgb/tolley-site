import { prisma } from "@/lib/prisma";
import {
  persistPngsToBlob,
  type ModalCallResult,
  normalizeOutputUrls,
} from "@/lib/generate-modal";
import { isGenerateJobStatus, type GenerateJobStatus } from "@/lib/generate-job-card";

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
}) {
  return {
    id: row.id,
    status: row.status,
    recipe: row.recipe,
    card: row.cardJson,
    modal_call_id: row.modalCallId,
    output_urls: row.outputUrls,
    error: row.error,
    createdBy: row.createdBy,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function applyModalResult(
  jobId: string,
  result: ModalCallResult,
): Promise<{ status: GenerateJobStatus; outputUrls: string[]; error: string | null }> {
  const urls = normalizeOutputUrls(result);
  let outputUrls = urls;
  if (!outputUrls.length && result.output_png_b64?.length) {
    try {
      outputUrls = await persistPngsToBlob(jobId, result.output_png_b64);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.generateJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: `Blob persist failed: ${message}`.slice(0, 2000),
          completedAt: new Date(),
        },
      });
      return { status: "failed", outputUrls: [], error: message };
    }
  }

  const failed = result.status === "failed" || Boolean(result.error && !outputUrls.length);
  const status: GenerateJobStatus = failed ? "failed" : "done";
  const error = result.error ? String(result.error).slice(0, 2000) : null;

  await prisma.generateJob.update({
    where: { id: jobId },
    data: {
      status,
      outputUrls,
      error,
      completedAt: new Date(),
    },
  });
  return { status, outputUrls, error };
}

export function coerceStatus(value: unknown): GenerateJobStatus | null {
  return typeof value === "string" && isGenerateJobStatus(value) ? value : null;
}
