"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

import { AGENT_MODEL_OPTIONS, AGENT_TOOL_OPTIONS } from "@/lib/agent-options";
import { normalizePlanTier } from "@/lib/subscription";

type AgentRecord = {
  id: string;
  name: string;
  rolePurpose: string;
  modelProvider: string;
  systemPrompt: string;
  toolsEnabled: string[];
  webhookUrl: string | null;
  phoneBinding: string | null;
  emailBinding: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgentDraft = {
  name: string;
  rolePurpose: string;
  modelProvider: string;
  systemPrompt: string;
  toolsEnabled: string[];
  webhookUrl: string;
  phoneBinding: string;
  emailBinding: string;
};

type AgentSetupDashboardProps = {
  initialPlan: string;
  initialStatus: string;
};

function createEmptyDraft(): AgentDraft {
  return {
    name: "",
    rolePurpose: "",
    modelProvider: AGENT_MODEL_OPTIONS[0],
    systemPrompt: "",
    toolsEnabled: [],
    webhookUrl: "",
    phoneBinding: "",
    emailBinding: "",
  };
}

function toDraft(agent: AgentRecord): AgentDraft {
  return {
    name: agent.name,
    rolePurpose: agent.rolePurpose,
    modelProvider: agent.modelProvider,
    systemPrompt: agent.systemPrompt,
    toolsEnabled: agent.toolsEnabled,
    webhookUrl: agent.webhookUrl || "",
    phoneBinding: agent.phoneBinding || "",
    emailBinding: agent.emailBinding || "",
  };
}

function sortAgents(items: AgentRecord[]) {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function AgentSetupDashboard({
  initialPlan,
  initialStatus,
}: AgentSetupDashboardProps) {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentDraft>(createEmptyDraft());
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const planTier = normalizePlanTier(initialPlan);
  const planLabel = planTier === "premium" ? "Premium" : "Basic";

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId],
  );

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/agents", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as {
        agents?: AgentRecord[];
        error?: string;
      };

      if (!response.ok || data.error) {
        setErrorMessage(data.error || "Unable to load agents.");
        setLoadingAgents(false);
        return;
      }

      const normalized = sortAgents(Array.isArray(data.agents) ? data.agents : []);
      setAgents(normalized);

      if (normalized.length === 0) {
        setSelectedAgentId(null);
        setDraft(createEmptyDraft());
      } else {
        setSelectedAgentId(normalized[0].id);
        setDraft(toDraft(normalized[0]));
      }
    } catch {
      setErrorMessage("Unable to load agents.");
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const handleSelectAgent = (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) {
      return;
    }
    setSelectedAgentId(agentId);
    setDraft(toDraft(agent));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleCreateDraft = () => {
    setSelectedAgentId(null);
    setDraft(createEmptyDraft());
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleToggleTool = (tool: string) => {
    setDraft((currentValue) => {
      const next = new Set(currentValue.toolsEnabled);
      if (next.has(tool)) {
        next.delete(tool);
      } else {
        next.add(tool);
      }
      return {
        ...currentValue,
        toolsEnabled: Array.from(next),
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      name: draft.name,
      rolePurpose: draft.rolePurpose,
      modelProvider: draft.modelProvider,
      systemPrompt: draft.systemPrompt,
      toolsEnabled: draft.toolsEnabled,
      webhookUrl: draft.webhookUrl,
      phoneBinding: draft.phoneBinding,
      emailBinding: draft.emailBinding,
    };

    try {
      const isCreate = !selectedAgentId;
      const url = isCreate ? "/api/agents" : `/api/agents/${selectedAgentId}`;
      const method = isCreate ? "POST" : "PATCH";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        agent?: AgentRecord;
        error?: string;
      };

      if (!response.ok || data.error || !data.agent) {
        setErrorMessage(data.error || "Unable to save agent.");
        return;
      }

      const savedAgent = data.agent;
      const nextAgents = sortAgents(
        isCreate
          ? [savedAgent, ...agents]
          : agents.map((agent) => (agent.id === savedAgent.id ? savedAgent : agent)),
      );
      setAgents(nextAgents);
      setSelectedAgentId(savedAgent.id);
      setDraft(toDraft(savedAgent));
      setSuccessMessage(isCreate ? "Agent created." : "Agent updated.");
    } catch {
      setErrorMessage("Unable to save agent.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgentId) {
      return;
    }

    setDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/agents/${selectedAgentId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || data.error) {
        setErrorMessage(data.error || "Unable to delete agent.");
        return;
      }

      const remaining = agents.filter((agent) => agent.id !== selectedAgentId);
      setAgents(remaining);
      if (remaining.length > 0) {
        setSelectedAgentId(remaining[0].id);
        setDraft(toDraft(remaining[0]));
      } else {
        setSelectedAgentId(null);
        setDraft(createEmptyDraft());
      }
      setSuccessMessage("Agent deleted.");
    } catch {
      setErrorMessage("Unable to delete agent.");
    } finally {
      setDeleting(false);
    }
  };

  const handleManageBilling = async () => {
    setOpeningBilling(true);
    setBillingError(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setBillingError(data.error || "Unable to open billing portal.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setBillingError("Unable to open billing portal.");
    } finally {
      setOpeningBilling(false);
    }
  };

  return (
    <main className="portal-shell ambient-noise relative min-h-screen w-full overflow-hidden px-5 py-8 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 mx-auto w-full max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
              t-agent
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white/95">
              Agent Setup
            </h1>
            <p className="mt-1 text-sm text-white/68">
              Configure purpose, model, tools, and bindings per agent.
            </p>
            <p className="mt-2 inline-flex items-center rounded-full border border-violet-200/35 bg-violet-300/12 px-3 py-1 text-[0.64rem] font-semibold tracking-[0.1em] text-violet-100 uppercase">
              Plan: {planLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleManageBilling()}
              disabled={openingBilling}
              className="rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/92 uppercase transition hover:bg-white/[0.11] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {openingBilling ? "Opening..." : "Manage Billing"}
            </button>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/92 uppercase transition hover:bg-white/[0.11]"
            >
              Logout
            </button>
          </div>
        </header>
        {billingError ? (
          <p className="mb-4 text-sm text-rose-200/90">{billingError}</p>
        ) : null}
        {initialStatus && initialStatus !== "none" ? (
          <p className="mb-4 text-xs tracking-[0.1em] text-white/58 uppercase">
            Subscription status: {initialStatus}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-white/17 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-4 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl">
            <button
              type="button"
              onClick={handleCreateDraft}
              className="mb-3 w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/92 uppercase transition hover:bg-white/[0.1]"
            >
              Create Agent
            </button>

            {loadingAgents ? (
              <p className="text-sm text-white/70">Loading agents...</p>
            ) : agents.length === 0 ? (
              <p className="text-sm text-white/68">No agents yet. Create your first one.</p>
            ) : (
              <ul className="space-y-2">
                {agents.map((agent) => {
                  const active = agent.id === selectedAgentId;
                  return (
                    <li key={agent.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectAgent(agent.id)}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-violet-300/65 bg-violet-300/12 text-white"
                            : "border-white/15 bg-black/20 text-white/82 hover:bg-black/30"
                        }`}
                      >
                        <p className="text-sm font-semibold">{agent.name}</p>
                        <p className="mt-1 text-xs text-white/62">{agent.modelProvider}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="rounded-3xl border border-white/17 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-4 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[0.68rem] tracking-[0.14em] text-white/64 uppercase">
                  Agent Name
                </label>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((currentValue) => ({
                      ...currentValue,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
                  placeholder="KC Buyer Lead Agent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-[0.68rem] tracking-[0.14em] text-white/64 uppercase">
                  Role / Purpose
                </label>
                <input
                  value={draft.rolePurpose}
                  onChange={(event) =>
                    setDraft((currentValue) => ({
                      ...currentValue,
                      rolePurpose: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
                  placeholder="Qualify and route buyer leads in Johnson County"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-[0.68rem] tracking-[0.14em] text-white/64 uppercase">
                  Model / Provider
                </label>
                <select
                  value={draft.modelProvider}
                  onChange={(event) =>
                    setDraft((currentValue) => ({
                      ...currentValue,
                      modelProvider: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
                >
                  {AGENT_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option} className="bg-[#0b0912]">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-[0.68rem] tracking-[0.14em] text-white/64 uppercase">
                  System Prompt
                </label>
                <textarea
                  value={draft.systemPrompt}
                  onChange={(event) =>
                    setDraft((currentValue) => ({
                      ...currentValue,
                      systemPrompt: event.target.value,
                    }))
                  }
                  rows={8}
                  className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm leading-6 text-white/92 outline-none transition focus:border-violet-300/75"
                  placeholder="You are a premium real-estate operations assistant..."
                />
              </div>

              <div className="sm:col-span-2">
                <p className="mb-2 text-[0.68rem] tracking-[0.14em] text-white/64 uppercase">
                  Tools Enabled
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AGENT_TOOL_OPTIONS.map((tool) => (
                    <label
                      key={tool}
                      className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/86"
                    >
                      <input
                        type="checkbox"
                        checked={draft.toolsEnabled.includes(tool)}
                        onChange={() => handleToggleTool(tool)}
                        className="h-4 w-4 accent-violet-300"
                      />
                      <span>{tool}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <p className="mb-2 text-[0.68rem] tracking-[0.14em] text-white/64 uppercase">
                  Bindings (Optional)
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    value={draft.webhookUrl}
                    onChange={(event) =>
                      setDraft((currentValue) => ({
                        ...currentValue,
                        webhookUrl: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
                    placeholder="Webhook URL"
                  />
                  <input
                    value={draft.phoneBinding}
                    onChange={(event) =>
                      setDraft((currentValue) => ({
                        ...currentValue,
                        phoneBinding: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
                    placeholder="Phone binding"
                  />
                  <input
                    value={draft.emailBinding}
                    onChange={(event) =>
                      setDraft((currentValue) => ({
                        ...currentValue,
                        emailBinding: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
                    placeholder="Email binding"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || deleting}
                className="rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={!selectedAgentId || deleting || saving}
                className="rounded-full border border-rose-200/35 bg-rose-300/10 px-4 py-2 text-xs font-semibold tracking-[0.1em] text-rose-100 uppercase transition hover:bg-rose-300/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>

            {errorMessage ? (
              <p className="mt-3 text-sm text-rose-200/90">{errorMessage}</p>
            ) : null}
            {successMessage ? (
              <p className="mt-3 text-sm text-emerald-200/90">{successMessage}</p>
            ) : null}

            {selectedAgent ? (
              <p className="mt-3 text-xs text-white/58">
                Last updated: {new Date(selectedAgent.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
