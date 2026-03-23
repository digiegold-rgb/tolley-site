"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DossierJob } from "../types";

interface UseDossierPollingOptions {
  jobId: string;
  syncKey: string;
  interval?: number; // ms, default 3000
  enabled?: boolean;
}

interface UseDossierPollingResult {
  job: DossierJob | null;
  isPolling: boolean;
  newSections: string[]; // steps that just completed (for highlight animation)
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDossierPolling({
  jobId,
  syncKey,
  interval = 3000,
  enabled = true,
}: UseDossierPollingOptions): UseDossierPollingResult {
  const [job, setJob] = useState<DossierJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [newSections, setNewSections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prevStepsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/dossier/${jobId}`, {
        headers: { "x-sync-secret": syncKey },
      });
      if (!res.ok) {
        setError(`Failed to fetch: ${res.status}`);
        return;
      }
      const data = await res.json();
      const fetchedJob = data.job as DossierJob;

      // Detect new sections
      const currentSteps = new Set(fetchedJob.stepsCompleted || []);
      const prevSteps = prevStepsRef.current;
      const justCompleted = [...currentSteps].filter((s) => !prevSteps.has(s));

      if (justCompleted.length > 0) {
        setNewSections(justCompleted);
        // Clear highlights after 3 seconds
        setTimeout(() => setNewSections([]), 3000);
      }

      prevStepsRef.current = currentSteps;
      setJob(fetchedJob);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    }
  }, [jobId, syncKey]);

  // Initial fetch
  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Polling loop
  useEffect(() => {
    if (!enabled || !job) return;

    const shouldPoll =
      job.status === "running" || job.status === "queued";

    if (shouldPoll) {
      setIsPolling(true);
      intervalRef.current = setInterval(fetchJob, interval);
    } else {
      setIsPolling(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, job?.status, interval, fetchJob]);

  return { job, isPolling, newSections, error, refetch: fetchJob };
}
