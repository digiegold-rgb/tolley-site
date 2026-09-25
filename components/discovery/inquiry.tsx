"use client";
import { useId, useState } from "react";
import { browserAttribution } from "@/lib/discovery-browser";
import { trackEvent } from "@/components/analytics/site-tracker";
export function HeardAbout({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return <label htmlFor={id} className="block text-sm">How did you hear about us? (optional)
    <input id={id} value={value} onChange={e => onChange(e.target.value)} maxLength={300} placeholder="ChatGPT, a friend, Google…" className="mt-2 block w-full rounded border border-neutral-500 bg-neutral-900 p-3 text-white" />
  </label>;
}
export function DiscoveryInquiry({ offering }: { offering: string }) {
  const [reported, setReported] = useState("");
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const data = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/discovery/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offering, name: data.get("name"), contact: data.get("contact"), details: data.get("details"), attribution: browserAttribution(reported) }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to send your inquiry.");
      setState("sent"); setMessage("Your inquiry has been received. For urgent requests, use the contact number above.");
      trackEvent(offering, "inquiry_success", undefined, { leadId: body.leadId });
    } catch (e) { setState("error"); setMessage(e instanceof Error ? e.message : "Unable to send. Please call instead."); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded border border-neutral-700 p-5">
    <h3 className="text-lg font-semibold">Ask about this service</h3>
    {state !== "sent" && <>
      <label className="block text-sm">Name<input name="name" required maxLength={120} autoComplete="name" className="mt-2 block w-full rounded bg-neutral-900 p-3 text-white" /></label>
      <label className="block text-sm">Phone or email<input name="contact" required maxLength={200} className="mt-2 block w-full rounded bg-neutral-900 p-3 text-white" /></label>
      <label className="block text-sm">What do you need?<textarea name="details" maxLength={2000} className="mt-2 block w-full rounded bg-neutral-900 p-3 text-white" /></label>
      <HeardAbout value={reported} onChange={setReported} />
      <button disabled={state === "sending"} className="rounded bg-white px-5 py-3 font-semibold text-black disabled:opacity-50">{state === "sending" ? "Sending…" : "Send inquiry"}</button>
    </>}
    {message && <p role="status">{message}</p>}
  </form>;
}
