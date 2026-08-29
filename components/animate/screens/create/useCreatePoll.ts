'use client';

/**
 * useCreatePoll — the CreateScreen's view of one YouTubeProject.
 *
 * Clone of screens/listing/useListingPoll.ts for the Jelly lane: loads the
 * row on id change, then polls every `intervalMs` ONLY while the derived
 * step kind is `async` (4 Writing / 7 Producing). Each tick kicks
 * `[id]/poll` first when the row is on the DGX (autopilotJobId + in-flight
 * status) so the DB catches up, then re-reads the row. Concierge rows never
 * hit /poll — they only re-read the row (the ticket moves by hand).
 *
 * `setProject` lets a step adopt the row a POST just returned without an
 * extra round trip; the poll picks up from there.
 */
import * as React from 'react';
import { deriveCreateStep } from '@/lib/vater/create-steps';
import { IN_FLIGHT_STATUSES, type YouTubeProjectStatus } from '@/lib/vater/youtube-status';
import { createApi, errorMessage, type CreateProject } from './create-api';

export interface CreatePollState {
  project: CreateProject | null;
  loading: boolean;
  error: string | null;
  polling: boolean;
  setProject: (p: CreateProject | null) => void;
  refresh: () => Promise<void>;
}

function onDgx(p: CreateProject | null): boolean {
  return !!p?.autopilotJobId && IN_FLIGHT_STATUSES.has(p.status as YouTubeProjectStatus);
}

export function useCreatePoll(projectId: string | null | undefined, intervalMs = 5000): CreatePollState {
  const [project, setProjectState] = React.useState<CreateProject | null>(null);
  const [loading, setLoading] = React.useState(!!projectId);
  const [error, setError] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);
  const alive = React.useRef(true);
  const projectRef = React.useRef<CreateProject | null>(null);

  const setProject = React.useCallback((p: CreateProject | null) => {
    projectRef.current = p;
    setProjectState(p);
  }, []);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!projectId) return;
    setPolling(true);
    try {
      let next: CreateProject | null = null;
      if (onDgx(projectRef.current)) next = await createApi.pollProject(projectId);
      if (!next) next = await createApi.getProject(projectId);
      if (!alive.current) return;
      setProject(next);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(errorMessage(err, 'Lost touch with the studio for a moment — still trying.'));
    } finally {
      if (alive.current) {
        setPolling(false);
        setLoading(false);
      }
    }
  }, [projectId, setProject]);

  // Load on id change — unless a step already handed us this exact row.
  React.useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (projectRef.current?.id === projectId) return;
    setProject(null);
    setLoading(true);
    void refresh();
  }, [projectId, refresh, setProject]);

  const status = project?.status;
  const active = project ? deriveCreateStep(project).kind === 'async' : false;
  React.useEffect(() => {
    if (!projectId || !active) return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled) return;
      await refresh();
    };
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // `status` re-arms the interval when the row moves between async phases.
  }, [projectId, active, status, intervalMs, refresh]);

  return { project, loading, error, polling, setProject, refresh };
}
