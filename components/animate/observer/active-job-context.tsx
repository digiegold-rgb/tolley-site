'use client';

/* ActiveJobContext — shared "which Vater job is the user currently focused on"
 * signal for the Observer slide-out.
 *
 * Why this lives here:
 *   The Observer renders globally inside Shell.tsx via <ObserverSlot />, but
 *   the screens that know which job is "active" (editor / live / studio /
 *   browse) are owned by sibling agents in Phase 2. Those screens get to set
 *   the active jobId via this context; the Observer reads it without ever
 *   importing those screens.
 *
 * Phase-2 wiring contract for sibling agents:
 *   1. Wrap your screen subtree in <ActiveJobProvider>.
 *   2. Call useSetActiveJob()(jobId) when a project is opened, and (null) on
 *      close/unmount.
 *   3. The Observer auto-narrows scope to that job and falls back to "all"
 *      when nothing is active — matching the legacy behaviour in
 *      VaterObserverSidebar.
 *
 * The default no-op context means: no provider mounted ⇒ Observer scope = all.
 */

import * as React from 'react';

export interface ActiveJobValue {
  /** Autopilot job id of the currently-focused project, if any. */
  activeJobId: string | null;
  /** Optional Prisma project id; carried for future filtering. */
  activeProjectId: string | null;
  /** Setter — sibling screens call this when a project is opened/closed. */
  setActiveJob: (
    next: { jobId: string | null; projectId?: string | null } | null,
  ) => void;
}

const defaultValue: ActiveJobValue = {
  activeJobId: null,
  activeProjectId: null,
  setActiveJob: () => {},
};

export const ActiveJobContext = React.createContext<ActiveJobValue>(defaultValue);

export function useActiveJob(): ActiveJobValue {
  return React.useContext(ActiveJobContext);
}

/** Convenience setter hook for screens that only need to write. */
export function useSetActiveJob(): ActiveJobValue['setActiveJob'] {
  return React.useContext(ActiveJobContext).setActiveJob;
}

export interface ActiveJobProviderProps {
  children: React.ReactNode;
}

export function ActiveJobProvider({
  children,
}: ActiveJobProviderProps): React.ReactElement {
  const [state, setState] = React.useState<{
    activeJobId: string | null;
    activeProjectId: string | null;
  }>({ activeJobId: null, activeProjectId: null });

  const setActiveJob = React.useCallback<ActiveJobValue['setActiveJob']>(
    (next) => {
      if (!next) {
        setState({ activeJobId: null, activeProjectId: null });
        return;
      }
      setState({
        activeJobId: next.jobId ?? null,
        activeProjectId: next.projectId ?? null,
      });
    },
    [],
  );

  const value = React.useMemo<ActiveJobValue>(
    () => ({ ...state, setActiveJob }),
    [state, setActiveJob],
  );

  return (
    <ActiveJobContext.Provider value={value}>
      {children}
    </ActiveJobContext.Provider>
  );
}
