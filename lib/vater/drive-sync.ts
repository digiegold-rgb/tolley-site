/**
 * lib/vater/drive-sync.ts — mirror an APPROVED script to the user's Google
 * Drive as a Google Doc (2026-08-28).
 *
 * Called from POST [id]/approve-script inside `after()` and from the manual
 * retry route POST [id]/drive-sync. Never throws: every outcome is returned
 * and persisted on the project (driveFileId/driveFileUrl/driveSyncedAt on
 * success, driveError = "<code>: <message>" on failure). An `api_not_enabled`
 * failure also flips the CONNECTION to status "error" so the Drive card can
 * explain it once instead of per project.
 *
 * Idempotent: an already-synced project whose approval is not newer than the
 * last sync returns ok without a second upload. A re-approval (edit → approve
 * again) creates a NEW doc — the old one stays in the folder as history.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import { createScriptDoc, DriveError, isDriveError } from "@/lib/vater/drive";

export interface DriveSyncResult {
  ok: boolean;
  url?: string;
  error?: string;
  skipped?: "not_linked" | "no_script";
}

const SITE = "https://www.tolley.io";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildScriptDoc(project: {
  id: string;
  sourceTitle: string | null;
  topic: string | null;
  script: string;
  targetDuration: number;
  scriptApprovedAt: Date | null;
}): { title: string; text: string } {
  const date = project.scriptApprovedAt ?? new Date();
  const baseTitle = (project.sourceTitle || project.topic || "Jelly script").trim();
  const title = `${baseTitle} — ${ymd(date)}`;
  const words = project.script.split(/\s+/).filter(Boolean).length;
  const header = [
    baseTitle,
    `Approved: ${ymd(date)}`,
    `Words: ${words}`,
    `Target: ${project.targetDuration} min`,
    `Jelly: ${SITE}/animate#r=create&p=${project.id}&s=5`,
  ].join("\n");
  return { title, text: `${header}\n\n${project.script}` };
}

export async function syncApprovedScriptToDrive(projectId: string): Promise<DriveSyncResult> {
  const project = await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      userId: true,
      sourceTitle: true,
      topic: true,
      script: true,
      targetDuration: true,
      scriptApprovedAt: true,
      driveFileId: true,
      driveFileUrl: true,
      driveSyncedAt: true,
    },
  });
  if (!project || !project.userId) return { ok: false, error: "project not found" };

  const script = (project.script ?? "").trim();
  if (!script || !project.scriptApprovedAt) return { ok: false, skipped: "no_script" };

  if (
    project.driveFileId &&
    project.driveSyncedAt &&
    project.scriptApprovedAt.getTime() <= project.driveSyncedAt.getTime()
  ) {
    return { ok: true, url: project.driveFileUrl ?? undefined };
  }

  const { rootUserId } = await resolveTenantIdentity(project.userId);
  const conn = await prisma.vaterDriveConnection.findUnique({ where: { userId: rootUserId } });
  if (!conn || conn.status === "revoked") return { ok: false, skipped: "not_linked" };

  const { title, text } = buildScriptDoc({ ...project, script });

  try {
    const doc = await createScriptDoc({ conn, title, text });
    await prisma.youTubeProject.update({
      where: { id: projectId },
      data: {
        driveFileId: doc.id,
        driveFileUrl: doc.webViewLink,
        driveSyncedAt: new Date(),
        driveError: null,
      },
    });
    console.log(`[vater/drive-sync] project=${projectId} → ${doc.webViewLink}`);
    return { ok: true, url: doc.webViewLink };
  } catch (err) {
    const derr: DriveError = isDriveError(err)
      ? err
      : new DriveError("unknown", err instanceof Error ? err.message : String(err));
    console.error(
      `[vater/drive-sync] project=${projectId} failed code=${derr.code} status=${derr.status ?? "-"} ${derr.detail}`,
    );
    await prisma.youTubeProject
      .update({ where: { id: projectId }, data: { driveError: derr.persisted } })
      .catch(() => undefined);
    if (derr.code === "api_not_enabled") {
      await prisma.vaterDriveConnection
        .update({ where: { id: conn.id }, data: { status: "error", lastError: derr.persisted } })
        .catch(() => undefined);
    }
    return { ok: false, error: derr.persisted };
  }
}
