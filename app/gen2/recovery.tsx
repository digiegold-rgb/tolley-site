"use client";

import { generationRecovery } from "@/lib/gen2-recovery";

export function FailureNotice({ error, scene, onReview, testId }: { error: string; scene?: number; onReview?: () => void; testId?: string }) {
  const recovery = generationRecovery(error);
  return <div className="gen-failure" role="alert" data-testid={testId}>
    <div className="gen-failure-heading"><span aria-hidden="true">!</span><strong>{scene ? `Scene ${scene}: ` : ""}{recovery.title}</strong></div>
    <p>{recovery.guidance}</p>
    <div className="gen-row">
      {onReview && <button type="button" className="gen-view-toggle" onClick={onReview}>Review scene {scene} →</button>}
      {recovery.billing && <a className="gen-view-toggle" href="https://fal.ai/dashboard/billing" target="_blank" rel="noreferrer">Open fal billing ↗</a>}
    </div>
    <details><summary>Original error details</summary><p className="gen-error-details">{error}</p></details>
  </div>;
}
