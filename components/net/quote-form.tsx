"use client";

import { HeardAbout } from "@/components/discovery/inquiry";
import { trackEvent } from "@/components/analytics/site-tracker";
import { browserAttribution } from "@/lib/discovery-browser";
import { visitorSessionId } from "@/lib/lead-capture-client";
import { TN_PHONE, TN_PHONE_SMS } from "@/lib/net";
import { useState } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function NetQuoteForm() {
  const [reported, setReported] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [projectType, setProjectType] = useState("Home / gaming");
  const [organization, setOrganization] = useState("");
  const [timeline, setTimeline] = useState("");
  const [problem, setProblem] = useState("");
  const [gaming, setGaming] = useState<"" | "yes" | "no">("");
  const [devices, setDevices] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus("error");
      setErrorMsg(`That email does not look complete. Fix it, or call or text ${TN_PHONE}.`);
      return;
    }
    if (phone.replace(/\D/g, "").length < 7 && !trimmedEmail) {
      setStatus("error");
      setErrorMsg("Add a phone number with at least 7 digits or an email so Jared can reach you.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/net/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: visitorSessionId(),
          name,
          phone,
          email: trimmedEmail,
          city,
          problem,
          projectType,
          organization,
          timeline,
          gaming: gaming || undefined,
          devices,
          preferredTime,
          attribution: browserAttribution(reported),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok !== true || typeof data?.leadId !== "string" || !data.leadId) {
        setStatus("error");
        setErrorMsg(
          (data && typeof data.error === "string" && data.error) ||
            (res.ok
              ? `We couldn't confirm your request was saved. Call or text us instead — ${TN_PHONE}.`
              : `Something went wrong (HTTP ${res.status}). Call or text us instead — ${TN_PHONE}.`),
        );
        return;
      }
      setStatus("success");
      trackEvent("net", "inquiry_success", undefined, { leadId: data.leadId });
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        `Couldn't reach the server (${err instanceof Error ? err.message : "network error"}). ` +
          `Call or text us instead — ${TN_PHONE}.`,
      );
    }
  }

  if (status === "success") {
    return (
      <div className="tc-diff p-8 text-center" role="status">
        <h3 className="tc-display text-2xl text-white">Thanks. Jared will follow up about your network.</h3>
        <p className="mt-3 text-sm text-white/60">
          Your consult request is received. Want to talk sooner?{" "}
          <a href={TN_PHONE_SMS} className="font-semibold text-[#ff7a1a] underline underline-offset-2">
            Text {TN_PHONE}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="tc-form space-y-4 p-6 sm:p-8">
      <p className="text-sm text-white/70">Your name and either a phone number or email are enough to start. Other details are optional.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tn-name" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
            Name <span className="text-[#ff7a1a]">*</span>
          </label>
          <input
            id="tn-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="tc-input min-h-11 px-3.5 py-2.5 text-base"
          />
        </div>
        <div>
          <label htmlFor="tn-phone" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
            Phone
          </label>
          <input
            id="tn-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your mobile number"
            autoComplete="tel"
            className="tc-input min-h-11 px-3.5 py-2.5 text-base"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tn-email" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
            Email
          </label>
          <input
            id="tn-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            className="tc-input min-h-11 px-3.5 py-2.5 text-base"
          />
        </div>
        <div>
          <label htmlFor="tn-city" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
            City
          </label>
          <input
            id="tn-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Independence"
            autoComplete="address-level2"
            className="tc-input min-h-11 px-3.5 py-2.5 text-base"
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">What kind of space?</legend>
        <div className="flex flex-wrap gap-3">
          {["Home / gaming", "Home office", "Small business"].map(choice => (
            <label key={choice} className="flex min-h-11 items-center gap-2 rounded border border-white/15 px-4 text-sm text-white/80">
              <input type="radio" name="projectType" value={choice} checked={projectType === choice} onChange={() => setProjectType(choice)} />{choice}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="tn-organization" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">Business / organization (optional)</label>
        <input id="tn-organization" type="text" autoComplete="organization" maxLength={160} value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Business name, if applicable" className="tc-input min-h-11 px-3.5 py-2.5 text-base" />
      </div>

      <div>
        <label htmlFor="tn-problem" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
          What would you like help with?
        </label>
        <textarea
          id="tn-problem"
          rows={4}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Opening an office, Wi-Fi dead spots, gaming lag, shared files, backups, remote access..."
          maxLength={2000}
          className="tc-input resize-y px-3.5 py-2.5 text-base"
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
          Do you game on this network?
        </legend>
        <div className="flex flex-wrap gap-3">
          {(["yes", "no"] as const).map((choice) => (
            <label key={choice} className="flex min-h-11 items-center gap-2 rounded border border-white/15 px-4 text-sm text-white/80">
              <input
                type="radio"
                name="gaming"
                value={choice}
                checked={gaming === choice}
                onChange={() => setGaming(choice)}
              />
              {choice === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="tn-devices" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
          Devices
        </label>
        <input
          id="tn-devices"
          type="text"
          value={devices}
          onChange={(e) => setDevices(e.target.value)}
          placeholder="Router or provider, number of computers, printers, cameras, NAS..."
          maxLength={500}
          className="tc-input min-h-11 px-3.5 py-2.5 text-base"
        />
      </div>

      <div>
        <label htmlFor="tn-time" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">
          Best time to contact you
        </label>
        <input
          id="tn-time"
          type="text"
          value={preferredTime}
          onChange={(e) => setPreferredTime(e.target.value)}
          placeholder="Weekday evenings, Saturday morning"
          className="tc-input min-h-11 px-3.5 py-2.5 text-base"
        />
      </div>

      <div>
        <label htmlFor="tn-timeline" className="mb-1.5 block text-sm font-semibold uppercase tracking-wider text-white/70">Project timing</label>
        <input id="tn-timeline" type="text" value={timeline} onChange={e => setTimeline(e.target.value)} maxLength={200} placeholder="Planning ahead, moving next month, an existing problem" className="tc-input min-h-11 px-3.5 py-2.5 text-base" />
      </div>

      <HeardAbout value={reported} onChange={setReported} />

      {status === "error" && (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="tc-btn-primary min-h-11 w-full rounded px-6 py-3.5 text-base font-bold disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Request my free consult"}
      </button>

      <p className="text-center text-sm text-white/70">By submitting, you ask Jared to contact you about this project. No payment or booking commitment. Please leave out passwords and access codes. <a href="/privacy" className="underline underline-offset-2">Privacy policy</a>.</p>
      <noscript><p className="text-sm text-white/70">To request a consult without JavaScript, call or text {TN_PHONE}.</p></noscript>
      <p className="text-center text-sm text-white/70">
        Or call or text Jared at{" "}
        <a href={TN_PHONE_SMS} className="font-semibold text-[#ff7a1a] underline underline-offset-2">
          {TN_PHONE}
        </a>
      </p>
    </form>
  );
}
