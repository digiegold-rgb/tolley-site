'use client';

/**
 * useListingPoll — polls GET /api/vater/listing/[id]/poll every `intervalMs`
 * while the job is in a moving state. Stops on ready / failed / cancelled /
 * draft / awaiting_approval (those wait for the agent, not the machine), and
 * resumes automatically when the caller hands back a job that is moving again
 * (approve → rendering).
 */
import * as React from 'react';
import type { ListingJobDto, ListingJobStatusValue } from '@/lib/vater/listing/contract';
import { listingApi, listingErrorMessage } from './listing-api';

const MOVING: ReadonlySet<ListingJobStatusValue> = new Set(['staging', 'rendering', 'finishing']);

export function isMovingStatus(status: ListingJobStatusValue | undefined | null): boolean {
  return !!status && MOVING.has(status);
}

export interface ListingPollState {
  job: ListingJobDto | null;
  error: string | null;
  /** True while a poll request is in flight. */
  polling: boolean;
  /** Replace the local job (after approve/restage/stage responses). */
  setJob: (job: ListingJobDto | null) => void;
  /** Force one poll now. */
  refresh: () => Promise<void>;
}

export function useListingPoll(jobId: string | null | undefined, initial: ListingJobDto | null = null, intervalMs = 5000): ListingPollState {
  const [job, setJob] = React.useState<ListingJobDto | null>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);
  const alive = React.useRef(true);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (initial && initial.id === jobId) setJob(initial);
  }, [initial, jobId]);

  const refresh = React.useCallback(async () => {
    if (!jobId) return;
    setPolling(true);
    try {
      const next = await listingApi.poll(jobId);
      if (!alive.current) return;
      setJob(next);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(listingErrorMessage(e, 'Lost touch with the studio for a moment — still trying.'));
    } finally {
      if (alive.current) setPolling(false);
    }
  }, [jobId]);

  const status = job?.status;
  React.useEffect(() => {
    if (!jobId) return;
    if (!isMovingStatus(status)) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };
    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobId, status, intervalMs, refresh]);

  return { job, error, polling, setJob, refresh };
}
