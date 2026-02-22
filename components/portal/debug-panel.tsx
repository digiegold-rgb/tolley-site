type DebugPanelProps = {
  visible: boolean;
  agentUrl: string;
  lastRequestId?: string;
  latency?: number;
  cached?: boolean;
  rawResponse: Record<string, unknown> | null;
  pingStatus: "idle" | "loading" | "success" | "error";
  pingError: string | null;
  pingResponse: Record<string, unknown> | null;
  onPing: () => void;
};

function renderRawJson(value: Record<string, unknown> | null) {
  if (!value) {
    return "No /api/ask response captured yet.";
  }

  return JSON.stringify(value, null, 2);
}

export function DebugPanel({
  visible,
  agentUrl,
  lastRequestId,
  latency,
  cached,
  rawResponse,
  pingStatus,
  pingError,
  pingResponse,
  onPing,
}: DebugPanelProps) {
  if (!visible) {
    return null;
  }

  return (
    <aside className="fixed right-4 bottom-4 z-50 w-[min(94vw,440px)] rounded-2xl border border-white/18 bg-[linear-gradient(140deg,rgba(255,255,255,0.15),rgba(145,89,230,0.1)),rgba(10,8,18,0.74)] p-4 text-white/88 shadow-[0_16px_45px_rgba(2,2,10,0.62)] backdrop-blur-xl sm:right-6 sm:bottom-6">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-[0.1em] uppercase">
          Debug Panel
        </h2>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[0.62rem] tracking-[0.12em] text-white/65 uppercase">
          Cmd+K
        </span>
      </header>

      <dl className="space-y-2 text-xs sm:text-[0.78rem]">
        <div className="flex justify-between gap-3">
          <dt className="text-white/65">AGENT_URL</dt>
          <dd className="max-w-[65%] truncate font-mono text-white/92">{agentUrl}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/65">requestId</dt>
          <dd className="max-w-[65%] truncate font-mono text-white/92">
            {lastRequestId || "-"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/65">latency</dt>
          <dd className="font-mono text-white/92">
            {typeof latency === "number" ? `${latency}ms` : "-"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/65">cached</dt>
          <dd className="font-mono text-white/92">
            {typeof cached === "boolean" ? String(cached) : "-"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-white/25 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-white/88 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onPing}
          disabled={pingStatus === "loading"}
        >
          {pingStatus === "loading" ? "Pinging..." : "Ping agent"}
        </button>
        <span className="text-[0.72rem] text-white/72">
          {pingStatus === "success" && "Ping successful"}
          {pingStatus === "error" && (pingError || "Ping failed")}
          {pingStatus === "idle" && "Idle"}
        </span>
      </div>

      {pingResponse ? (
        <pre className="mt-3 max-h-28 overflow-auto rounded-xl border border-white/15 bg-black/30 p-2 text-[0.66rem] leading-5 text-violet-100/90">
          {renderRawJson(pingResponse)}
        </pre>
      ) : null}

      <h3 className="mt-4 text-[0.68rem] tracking-[0.14em] text-white/65 uppercase">
        Raw /api/ask JSON
      </h3>
      <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/15 bg-black/30 p-2 text-[0.66rem] leading-5 text-violet-100/88">
        {renderRawJson(rawResponse)}
      </pre>
    </aside>
  );
}
