"use client";
import { useState } from "react";
export function ReceiptActions({
  id,
  token,
  status,
  reviewed,
}: {
  id: string;
  token: string;
  status: string;
  reviewed: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(action: string, data: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/laundry/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token, action, ...data }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }
  return (
    <div>
      {["requested", "accepted", "booked"].includes(status) && (
        <details>
          <summary>Cancel this request</summary>
          <p>
            This cancels an unfulfilled delivery request. It does not cancel an
            existing rental subscription.
          </p>
          <button
            className="ghost"
            disabled={busy}
            onClick={() => send("cancel")}
          >
            Confirm cancellation
          </button>
        </details>
      )}
      {status === "delivered" && !reviewed && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send("review", {
              rating: Number(f.get("rating")),
              body: f.get("body"),
            });
          }}
        >
          <h3>How did your delivery go?</h3>
          <label>
            Rating
            <select name="rating" defaultValue="5">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
          <label>
            Your review
            <textarea name="body" minLength={10} maxLength={2000} required />
          </label>
          <p className="tiny">
            Your first name and last initial will appear publicly. Please leave
            out personal contact details.
          </p>
          <button disabled={busy}>Publish review</button>
        </form>
      )}
      {reviewed && <p className="success">Thank you. Your review was saved.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
