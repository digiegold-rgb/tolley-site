"use client";

import { useState } from "react";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const QUICK_ACTIONS: Array<{ label: string; method: HttpMethod; path: string }> = [
  { label: "Health", method: "GET", path: "/health" },
  { label: "Doctor", method: "GET", path: "/doctor" },
  { label: "Gateway Status", method: "GET", path: "/gateway/status" },
  { label: "Agents List", method: "GET", path: "/agents" },
  { label: "Cron List", method: "GET", path: "/cron" },
];

function normalizePath(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "/health";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function OpenClawAdminConsole() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/health");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runRequest = async (nextMethod?: HttpMethod, nextPath?: string) => {
    const resolvedMethod = nextMethod || method;
    const resolvedPath = normalizePath(nextPath || path);

    setLoading(true);
    setErrorMessage(null);
    setStatus(null);
    setResponseText("");

    try {
      let parsedBody: string | null = null;
      if (!["GET", "DELETE"].includes(resolvedMethod)) {
        const trimmedBody = body.trim();
        if (trimmedBody) {
          JSON.parse(trimmedBody);
          parsedBody = trimmedBody;
        }
      }

      const response = await fetch(`/api/admin/openclaw${resolvedPath}`, {
        method: resolvedMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: parsedBody,
      });

      const text = await response.text();
      setStatus(response.status);

      try {
        const parsed = JSON.parse(text);
        setResponseText(JSON.stringify(parsed, null, 2));
      } catch {
        setResponseText(text || "(empty response)");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to call admin API.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-5 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-2xl">
      <h2 className="text-lg font-semibold text-white/95">OpenClaw Control Plane</h2>
      <p className="mt-1 text-sm text-white/72">
        All calls go through secured server-side proxy routes.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((item) => (
          <button
            key={`${item.method}:${item.path}`}
            type="button"
            onClick={() => void runRequest(item.method, item.path)}
            disabled={loading}
            className="rounded-full border border-white/20 bg-white/[0.05] px-3 py-1.5 text-[0.68rem] font-semibold tracking-[0.08em] text-white/88 uppercase transition hover:bg-white/[0.1] disabled:opacity-60"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as HttpMethod)}
          className="rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>

        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/agents"
          className="rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/92 outline-none transition focus:border-violet-300/75"
        />
      </div>

      <label className="mt-3 block text-[0.68rem] tracking-[0.12em] text-white/60 uppercase">
        JSON Body (for POST/PUT/PATCH)
      </label>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={8}
        className="mt-1 w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm leading-6 text-white/90 outline-none transition focus:border-violet-300/75"
        placeholder='{"name":"New Agent"}'
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void runRequest()}
          disabled={loading}
          className="rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Running..." : "Run"}
        </button>
        {status ? (
          <span className="rounded-full border border-white/16 bg-black/22 px-3 py-1 text-xs tracking-[0.08em] text-white/76 uppercase">
            Status {status}
          </span>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-3 text-sm text-rose-200/90">{errorMessage}</p>
      ) : null}

      <pre className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-white/14 bg-black/35 p-3 text-xs leading-6 text-white/84">
        {responseText || "No response yet."}
      </pre>
    </section>
  );
}
