"use client";
import { useEffect, useRef, useState } from "react";
import { browserAttribution } from "@/lib/discovery-browser";
import { UNIT_NAMES } from "@/lib/laundry/config";
import type { publicOperator } from "@/lib/laundry/store";
export function RequestForm({
  operators,
  initialOperator = "",
  initialZip = "",
  existing,
}: {
  operators: ReturnType<typeof publicOperator>[];
  initialOperator?: string;
  initialZip?: string;
  existing?: { id: string; token: string; name: string; unit: string };
}) {
  const [operator, setOperator] = useState(initialOperator),
    [unit, setUnit] = useState(existing?.unit || "set"),
    [agreement, setAgreement] = useState<{ text: string; hash: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const requestKey = useRef<string | null>(null);
  const op = operators.find((o) => o.id === operator);
  useEffect(() => {
    setAgreement(null);
    if (!operator) return;
    let cancelled = false;
    fetch(
      `/api/laundry/agreement?operator=${encodeURIComponent(operator)}&unit=${unit}`,
    )
      .then(async (r) => {
        const b = await r.json();
        if (!cancelled) {
          if (r.ok) {
            setAgreement(b);
            setError("");
          } else setError(b.error);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("Could not load the agreement. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [operator, unit]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    requestKey.current ??= crypto.randomUUID();
    try {
      const b = existing
        ? {
            action: "reassign",
            id: existing.id,
            token: existing.token,
            operatorId: operator,
            agreementHash: agreement?.hash,
            signedName: f.get("signedName"),
            termsAccepted: f.get("termsAccepted") === "on",
          }
        : {
            requestKey: requestKey.current,
            operatorId: operator || null,
            name: f.get("name"),
            phone: f.get("phone"),
            email: f.get("email"),
            address: f.get("address"),
            zip: f.get("zip"),
            unit,
            preferredDate: f.get("preferredDate"),
            notes: f.get("notes"),
            smsConsent: f.get("smsConsent") === "on",
            termsAccepted: f.get("termsAccepted") === "on",
            signedName: f.get("signedName") || "",
            agreementHash: agreement?.hash || "",
            attribution: browserAttribution(
              String(f.get("reportedSource") || ""),
            ),
            website: f.get("website") || "",
          };
      const r = await fetch("/api/laundry/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (existing) window.location.reload();
      else window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setBusy(false);
    }
  }
  return (
    <form className="form card" onSubmit={submit}>
      <label>
        Choose your operator
        <select
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          required={!!existing}
        >
          <option value="">No operator yet — join the interest list</option>
          {operators.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · {o.city}, {o.state}
            </option>
          ))}
        </select>
      </label>
      {!existing && (
        <>
          <div className="fields">
            <label>
              Full name
              <input name="name" required autoComplete="name" maxLength={120} />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" required autoComplete="tel" />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
            <label>
              Delivery ZIP
              <input
                name="zip"
                defaultValue={initialZip}
                pattern="[0-9]{5}"
                maxLength={5}
                required
                autoComplete="postal-code"
              />
            </label>
          </div>
          <label>
            Street address, apartment and city
            <input
              name="address"
              required
              autoComplete="street-address"
              minLength={5}
              maxLength={300}
            />
          </label>
          <div className="fields">
            <label>
              What do you need?
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {Object.entries(UNIT_NAMES).map(([key, name]) => (
                  <option
                    key={key}
                    value={key}
                    disabled={!!op && !op.prices[key as keyof typeof op.prices]}
                  >
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preferred delivery day
              <input
                name="preferredDate"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
          </div>
          <label>
            Hookups, stairs and delivery notes
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="Tell us about your hookups, access or scheduling needs."
            />
          </label>
          <label>
            How did you hear about us? (optional)
            <input name="reportedSource" maxLength={300} />
          </label>
          <label className="hp" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="check">
            <input name="smsConsent" type="checkbox" />
            Text me about this request. Optional; consent is not required to
            rent. Message frequency varies; message/data rates may apply. Reply
            STOP to stop or HELP for help.
          </label>
        </>
      )}
      {operator && (
        <div>
          <h3>Read your rental agreement</h3>
          {agreement ? (
            <>
              <pre className="agreement" tabIndex={0}>
                {agreement.text}
              </pre>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([agreement.text], { type: "text/plain" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "rental-agreement.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Save a copy before signing
              </button>
            </>
          ) : (
            <p>Loading this operator’s current agreement…</p>
          )}
          <label style={{ marginTop: 20 }}>
            Type your full name to sign{existing ? ` (${existing.name})` : ""}
            <input name="signedName" required minLength={2} maxLength={120} />
          </label>
        </div>
      )}
      <label className="check">
        <input name="termsAccepted" type="checkbox" required />
        <span>
          I agree to the{" "}
          <a href="/laundry/terms" target="_blank" rel="noreferrer">
            renter terms
          </a>{" "}
          and acknowledge the{" "}
          <a href="/laundry/privacy" target="_blank" rel="noreferrer">
            privacy policy
          </a>
          .{" "}
          {operator
            ? "I have read and intend to sign the displayed operator agreement, consent to electronic records, and authorize sharing my request with this operator."
            : "I understand this saves my interest and does not reserve equipment or confirm delivery."}
        </span>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button disabled={busy || (!!operator && !agreement)}>
        {busy
          ? "Saving your request…"
          : operator
            ? "Sign & request delivery"
            : "Save my interest"}
      </button>
      <p className="tiny">
        No payment is collected here. Your operator confirms the delivery date
        and collects rent separately.
      </p>
    </form>
  );
}
