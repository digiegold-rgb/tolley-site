"use client";

import { createContext, useContext, useState, useId, type ReactNode } from "react";
import { GENERATE_WORKFLOWS, WORKFLOW_STEPS, type WorkflowMode, type WorkflowStep } from "@/lib/generate-workflow";

export const WorkflowContext = createContext<{ step: WorkflowStep; all: boolean }>({ step: 0, all: false });

/** Disclosure changes presentation only: advanced values stay applied when closed. */
export function AdvancedOptions({ children, hint, title = "Advanced options" }: { children: ReactNode; hint: string; title?: string }) {
  const { all } = useContext(WorkflowContext);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return <section className="gen-advanced-options">
    <button type="button" className="gen-advanced-toggle" aria-expanded={all || open} aria-controls={panelId} onClick={() => setOpen(v => !v)} disabled={all}>
      <span><strong>{title}</strong><small>{hint}</small></span><span aria-hidden="true">{all || open ? "−" : "+"}</span>
    </button>
    <div id={panelId} className="gen-advanced-content" hidden={!all && !open}>
      <p className="gen-hint">Closing this panel keeps your settings. All controls view expands these options too.</p>
      {children}
    </div>
  </section>;
}

/** Keep forms mounted across steps so file selections and editor drafts survive navigation. */
export function WorkflowSection({ step, children }: { step: WorkflowStep | WorkflowStep[]; children: ReactNode }) {
  const view = useContext(WorkflowContext);
  const visible = view.all || (Array.isArray(step) ? step.includes(view.step) : step === view.step);
  return <div className="gen-workflow-section" hidden={!visible}>{children}</div>;
}

export function WorkflowPicker({ mode, disabled, onSelect, authenticated, modal, fal }: { authenticated: boolean | null; modal?: boolean; fal?: boolean; mode: WorkflowMode; disabled: boolean; onSelect: (mode: WorkflowMode) => void }) {
  return <div className="gen-workflow-picker">
    {["Start simple", "Direct every detail"].map(group => <div key={group}>
      <h3 className="gen-choice-group">{group}</h3>
      <div className="gen-workflow-choices">
        {GENERATE_WORKFLOWS.filter(item => item.group === group).map(item => <button
          key={item.id} type="button" className={`gen-workflow-choice${mode === item.id ? " is-selected" : ""}`}
          disabled={disabled} aria-pressed={mode === item.id} onClick={() => onSelect(item.id)}>
          <span className="gen-choice-title">{item.title}<span aria-hidden="true">{mode === item.id ? "✓" : "↗"}</span></span>
          <span className="gen-choice-description">{item.description}</span>
          <span className="gen-choice-output">{item.output}</span>
          <span className="gen-choice-engine">{item.engine}</span>
          <span className="gen-choice-availability">{authenticated !== true ? "Sign in to check provider availability" : (item.id === "modal" ? modal || fal : fal) === true ? "Provider configured · ready to prepare" : (item.id === "modal" ? modal === false && fal === false : fal === false) ? "Provider setup required" : "Checking provider…"}</span>
        </button>)}
      </div>
    </div>)}
    <p className="gen-hint">Provider status checks configuration; it does not guarantee a successful render. Video → Video is not available yet. To start from existing media, choose Animate an image.</p>
  </div>;
}

export function WorkflowNav({ step, all, onStep, onAll, disabled }: { disabled: boolean; step: WorkflowStep; all: boolean; onStep: (step: WorkflowStep) => void; onAll: () => void }) {
  return <div className="gen-workflow-nav">
    <nav aria-label="Creation steps"><ol>
      {WORKFLOW_STEPS.map((label, i) => <li key={label}>
        <button type="button" disabled={disabled} aria-current={!all && step === i ? "step" : undefined} onClick={() => onStep(i as WorkflowStep)}>
          <span className="gen-step-number">{i + 1}</span><span>{label}</span>
        </button>
      </li>)}
    </ol></nav>
    <button type="button" disabled={disabled} className="gen-view-toggle" aria-pressed={all} onClick={onAll}>{all ? "Guided view" : "All controls"}</button>
  </div>;
}
