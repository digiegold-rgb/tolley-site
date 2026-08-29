'use client';

/**
 * CreateFlowContext — what every step panel needs from the CreateScreen host.
 * Kept out of props so a step can be moved or split without re-threading.
 */
import * as React from 'react';
import type { DerivedCreateStep } from '@/lib/vater/create-steps';
import type { CreateProject, StyleSummary } from './create-api';

export interface CreateFlowValue {
  project: CreateProject | null;
  /** deriveCreateStep(project), null before a project exists. */
  derived: DerivedCreateStep | null;
  /** The step the panel on the right is showing (1–8). */
  viewStep: number;
  /** True when the view is BEHIND the machine — inputs disabled, history only. */
  readOnly: boolean;
  /** Adopt a row a POST returned; also selects it and pulls the badge forward. */
  adopt: (p: CreateProject) => void;
  /** Move the view (pushes history via the Shell hash writer). */
  goTo: (step: number) => void;
  /** Re-read the row now. */
  refresh: () => Promise<void>;
  /** Styles this account can start from; `styleId` is the current pick. */
  styles: StyleSummary[];
  stylesLoaded: boolean;
  styleId: string | null;
  setStyleId: (id: string | null) => void;
  /** Step 1 → 2 hand-off before a project exists (a URL waiting to be read). */
  pendingUrl: string;
  setPendingUrl: (url: string) => void;
}

export const CreateFlowContext = React.createContext<CreateFlowValue | null>(null);

export function useCreateFlow(): CreateFlowValue {
  const v = React.useContext(CreateFlowContext);
  if (!v) throw new Error('useCreateFlow must be used inside CreateScreen');
  return v;
}
