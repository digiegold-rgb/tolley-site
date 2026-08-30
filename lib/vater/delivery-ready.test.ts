import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { customerStage, customerStageDetail } from "./youtube-status";
import { deriveCreateStep } from "./create-steps";
import {
  READY_FLOW_STEP,
  auditDeliveryWarning,
  incomingAutopilotJobId,
  isStitchJobDone,
  isWatchingUnsyncedCompose,
  persistStatusForSync,
  rowLooksFileReady,
  rowNeedsReadyPromote,
  shouldPreserveReadyStatus,
  type DeliveryRow,
} from "./delivery-ready";

/** Video #66 after Spark finished and QA had already notified. */
function row66(over: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    status: "concierge_in_progress",
    flowStep: 7,
    finalVideoUrl:
      "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/vater-finals/cmtfqjn6w0001l204i63rovrr.mp4",
    progress: 100,
    completedAt: "2026-08-30T14:48:11.804Z",
    autopilotJobId: "6946b98bc9f9433b",
    stepDetails: {
      phase: "done",
      jobStatus: "done",
      progress: 100,
      jobId: "6946b98bc9f9433b",
    },
    settingsJson: {
      engine: "fable5",
      concierge: { code: "F5-608GTB", stage: "qa", composeJobId: "6946b98bc9f9433b" },
    },
    ...over,
  };
}

describe("isStitchJobDone — the fields Spark actually writes", () => {
  it("treats phase done / jobStatus done / progress 100 / completedAt as done", () => {
    assert.equal(isStitchJobDone({ stepDetails: { phase: "done" } }), true);
    assert.equal(isStitchJobDone({ stepDetails: { jobStatus: "done" } }), true);
    assert.equal(isStitchJobDone({ stepDetails: { progress: 100 } }), true);
    assert.equal(isStitchJobDone({ progress: 100 }), true);
    assert.equal(isStitchJobDone({ completedAt: "2026-08-30T14:48:11.804Z" }), true);
    assert.equal(isStitchJobDone({ stepDetails: { phase: "composing" }, progress: 40 }), false);
  });
});

describe("#66 sequence: QA notify then render.ready left status concierge", () => {
  it("file-ready row is library-done even while status is still concierge_in_progress", () => {
    const row = row66();
    assert.equal(rowLooksFileReady(row), true);
    assert.equal(rowNeedsReadyPromote(row), true);
    assert.equal(customerStage(row), "done");
    assert.equal(customerStageDetail(row), "Ready");
    assert.equal(deriveCreateStep(row).step, READY_FLOW_STEP);
    assert.equal(deriveCreateStep(row).kind, "terminal");
    assert.equal(deriveCreateStep(row).active, false);
  });

  it("audit_missing does not hide the file from the library", () => {
    const row = row66({
      settingsJson: {
        engine: "fable5",
        concierge: { code: "F5-608GTB", stage: "qa", audit: null },
      },
    });
    const warning = auditDeliveryWarning(null, false);
    assert.equal(warning?.code, "audit_missing");
    assert.equal(customerStage(row), "done");
    assert.equal(rowLooksFileReady(row), true);
  });

  it("failed audit (182/189 then re-compose) is a warning, not a block", () => {
    const warning = auditDeliveryWarning(
      { passed: false, hardFails: 182, sceneCount: 189, round: 1, reportUrl: "https://x/audit.html" },
      true,
    );
    assert.equal(warning?.code, "audit_failed");
    assert.equal(rowLooksFileReady(row66()), true);
  });

  it("sync must persist ready when the job maps to ready (not log-only)", () => {
    assert.equal(persistStatusForSync("concierge", "concierge_in_progress", "ready"), "ready");
    assert.equal(
      persistStatusForSync("concierge", "concierge_in_progress", "composing_video"),
      "concierge_in_progress",
    );
    assert.equal(persistStatusForSync("auto", "composing_video", "ready"), "ready");
  });

  it("QA stage write after delivery cannot clobber ready back to concierge", () => {
    assert.equal(
      shouldPreserveReadyStatus({
        currentStatus: "ready",
        incomingStatus: "concierge_in_progress",
        incomingAutopilotJobId: null,
      }),
      true,
    );
    // Compose / kickoff names a new job — allowed to leave ready.
    assert.equal(
      shouldPreserveReadyStatus({
        currentStatus: "ready",
        incomingStatus: "concierge_in_progress",
        incomingAutopilotJobId: "newcompose99",
      }),
      false,
    );
    assert.equal(
      incomingAutopilotJobId({ autopilotJobId: "newcompose99" }),
      "newcompose99",
    );
  });
});

describe("re-compose must not bounce a live stitch back to ready", () => {
  it("watching a new compose job while stepDetails still say the old one is done", () => {
    const midRepair = row66({
      autopilotJobId: "newcompose99",
      composeJobId: "newcompose99",
      settingsJson: {
        engine: "fable5",
        concierge: { composeJobId: "newcompose99", jobId: "6946b98bc9f9433b" },
      },
      stepDetails: {
        phase: "done",
        jobStatus: "done",
        progress: 100,
        jobId: "6946b98bc9f9433b",
      },
    });
    assert.equal(isWatchingUnsyncedCompose(midRepair), true);
    assert.equal(rowLooksFileReady(midRepair), false);
    assert.equal(rowNeedsReadyPromote(midRepair), false);
    assert.equal(customerStage(midRepair), "in_progress");
  });

  it("after compose+repoint, stitch details for the compose job still count as done", () => {
    const afterRepoint = row66({
      autopilotJobId: "renderjob",
      settingsJson: {
        engine: "fable5",
        concierge: { jobId: "renderjob", composeJobId: "composejob" },
      },
      stepDetails: {
        phase: "done",
        jobStatus: "done",
        progress: 100,
        jobId: "composejob",
      },
    });
    assert.equal(isWatchingUnsyncedCompose(afterRepoint), false);
    assert.equal(rowLooksFileReady(afterRepoint), true);
    assert.equal(customerStage(afterRepoint), "done");
  });
});

describe("do not promote parked drafts that still have an old final", () => {
  it("transcribed leftover is not library-ready", () => {
    const leftover = row66({ status: "transcribed", flowStep: 2 });
    assert.equal(rowLooksFileReady(leftover), true);
    assert.equal(rowNeedsReadyPromote(leftover), false);
    assert.equal(customerStage(leftover), customerStage("transcribed"));
    assert.equal(deriveCreateStep(leftover).step, 2);
  });
});

describe("bare status strings stay in_progress (optimistic chips)", () => {
  it("concierge_in_progress without a row is still Moving Now", () => {
    assert.equal(customerStage("concierge_in_progress"), "in_progress");
    assert.equal(
      customerStage({ status: "concierge_in_progress", finalVideoUrl: null }),
      "in_progress",
    );
  });
});

describe("source contracts — persist ready, do not 409 audit_missing", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");

  it("sync persists the mapped ready status and verifies after write", () => {
    const src = read("lib/vater/project-sync.ts");
    assert.match(src, /persistStatusForSync/);
    assert.match(src, /promoteReadyIfDelivered/);
    assert.match(src, /updated\.status as YouTubeProjectStatus/);
    assert.equal(/status: policy === "concierge" \? project\.status : nextStatus/.test(src), false);
  });

  it("/deliver treats audit as a warning, not a 409 gate", () => {
    const src = read("app/api/vater/concierge/[ticket]/deliver/route.ts");
    assert.match(src, /auditDeliveryWarning/);
    assert.equal(/code: "audit_missing"/.test(src), false);
    assert.equal(/return jsonError\(\s*409[\s\S]*audit_failed/.test(src), false);
  });

  it("writeConcierge refuses to clobber ready without a new job", () => {
    const src = read("lib/vater/concierge.ts");
    assert.match(src, /shouldPreserveReadyStatus/);
    assert.match(src, /opts\.status && !keepReady/);
  });

  it("library and project GET reconcile stuck rows", () => {
    assert.match(read("app/api/vater/youtube/route.ts"), /reconcileStuckDeliveries/);
    assert.match(read("app/api/vater/youtube/[id]/route.ts"), /reconcileStuckDeliveries/);
  });
});
